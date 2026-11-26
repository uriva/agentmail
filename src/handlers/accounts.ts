import { db, id } from "../db.ts";
import { getUtcDayStart, planDetails } from "../planData.ts";
import { withKeyedLock } from "../security.ts";
import { captureEvent, trackBackgroundTask } from "../services/posthog.ts";
import { emailDomain, sendEmail } from "../services/resend.ts";
import { deleteFile } from "../services/storage.ts";
import type { ApiResponse, CreateAccountInput } from "../types.ts";

const reservedKeywords = [
  "meta",
  "facebook",
  "instagram",
  "whatsapp",
  "google",
  "microsoft",
  "apple",
  "amazon",
  "paypal",
  "stripe",
  "support",
  "security",
  "admin",
  "administrator",
  "postmaster",
  "hostmaster",
  "webmaster",
  "abuse",
  "dmarc",
  "noreply",
  "no-reply",
  "mailer-daemon",
  "root",
  "noc",
  "notifications",
  "notification",
  "info",
  "sales",
  "legal",
  "privacy",
  "agentmail",
  "theagentmail",
  "billing",
  "verification",
  "official",
  "helpdesk",
  "service",
  "system",
  "alert",
  "verify",
  "uri",
];

const validLocalPartPattern = /^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/;

const notifyOverseer = (
  address: string,
  displayName: string | undefined,
  orgId: string,
) => {
  const overseerEmail = Deno.env.get("OVERSEER_EMAIL") ?? "";
  if (Deno.env.get("DENO_ENV") === "test" || !overseerEmail) {
    return Promise.resolve();
  }
  return db
    .query({
      organizations: {
        $: { where: { id: orgId } },
        billingUser: {},
        members: {},
      },
    })
    .then(({ organizations }) => {
      const org = organizations[0];
      const orgName = org?.name ?? "Unknown";
      const billingEmail = org?.billingUser?.email ?? "Unknown";
      if (billingEmail.endsWith("@example.com")) {
        return Promise.resolve();
      }
      const memberEmails = org?.members?.map((m) =>
        m.email
      ).filter(Boolean).join(", ") ||
        "Unknown";
      return sendEmail({
        from: `notifications@${emailDomain}`,
        to: [overseerEmail],
        subject: `[AgentMail Overseer] New email address created: ${address}`,
        text: `A new email address has been created in AgentMail.

Address: ${address}
Display Name: ${displayName || "(none)"}
Organization: ${orgName} (${orgId})
Billing User Email: ${billingEmail}
Members: ${memberEmails}
Created At: ${new Date().toISOString()}`,
      });
    })
    .catch((err) =>
      console.error("[notifyOverseer] Failed to send notification email:", err)
    );
};

const sendTrialWelcomeEmail = (
  billingEmail: string | undefined,
  address: string,
): Promise<unknown> =>
  Deno.env.get("DENO_ENV") === "test" ||
    !billingEmail ||
    billingEmail.endsWith("@example.com")
    ? Promise.resolve()
    : sendEmail({
      from: `AgentMail <support@${emailDomain}>`,
      to: [billingEmail],
      subject: `Your agent inbox ${address} is live`,
      text: `Hi,

Your new AgentMail inbox ${address} is live for 30 days.

Fastest ways to connect your agent:

1. Remote MCP (Claude Code, Cursor, OpenCode — no local install):
   Generate an account-scoped API key in your dashboard, then run:
   claude mcp add --transport http agentmail https://api.theagentmail.net/mcp --header "Authorization: Bearer am_..."

2. Direct REST / Coding Agent:
   Hand your agent its scoped API key and https://theagentmail.net/llms.txt so it can send, read, and verify signed webhooks immediately.

Note on OTP & signup verification emails:
Free trial mailboxes include normal send/receive and webhooks, while inbound signup/OTP verification emails unlock immediately when you add a $5 prepaid deposit (5 mailbox-months, never expires, 1,000 sends & receives/mo):
https://theagentmail.net/app

Reply directly to this email if you run into anything.

AgentMail (https://theagentmail.net)`,
    }).catch((err) =>
      console.error("[sendTrialWelcomeEmail] Failed to send welcome email:", err)
    );

const isReservedOrSuspicious = (
  localPart: string,
  displayName?: string,
): boolean => {
  const normalizedPart = localPart.toLowerCase();
  const normalizedDisplay = (displayName ?? "").toLowerCase();
  return reservedKeywords.some(
    (kw) => normalizedPart.includes(kw) || normalizedDisplay.includes(kw),
  );
};

const createAccount = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const input = (await req.json()) as CreateAccountInput;
  if (!input?.address || typeof input.address !== "string") {
    return Response.json(
      { error: "address is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const localPart = (
    input.address.includes("@") ? input.address.split("@")[0]! : input.address
  ).trim().toLowerCase();

  if (!validLocalPartPattern.test(localPart) || localPart.includes("..")) {
    return Response.json(
      {
        error:
          "Invalid mailbox address format. Use lowercase letters, numbers, dots, hyphens, or underscores.",
        code: "INVALID_ADDRESS",
      },
      { status: 400 },
    );
  }

  const address = `${localPart}@${emailDomain}`;

  return withKeyedLock(`org:${orgId}`, async () => {
    const { organizations } = await db.query({
      organizations: {
        $: { where: { id: orgId } },
        billingUser: {},
        members: {},
      },
    });
    const org = organizations[0];
    if (!org) {
      return Response.json(
        { error: "Organization not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    const isAdmin = Boolean(org.admin);

    if (!isAdmin && isReservedOrSuspicious(localPart, input.displayName)) {
      return Response.json(
        {
          error: "This address or display name is reserved or restricted",
          code: "RESERVED_ADDRESS",
        },
        { status: 400 },
      );
    }

    const { accounts: existingAccounts } = await db.query({
      accounts: { $: { where: { address } } },
    });
    if (existingAccounts.length > 0) {
      return Response.json(
        {
          error: "This email address is already in use",
          code: "ADDRESS_EXISTS",
        },
        { status: 409 },
      );
    }

    const currentBalance = org.balance ?? 0;
    const isTrial = !isAdmin && !org.trialUsed;

    if (isTrial) {
      const isPhoneVerified = Boolean(
        org.billingUser?.phoneVerified ||
          org.members?.some((m) => m.phoneVerified),
      );
      if (!isPhoneVerified) {
        captureEvent(orgId, "account_creation_blocked", {
          reason: "phone_verification_required",
        });
        return Response.json(
          {
            error:
              "Phone verification is required to claim your free 1-month trial",
            code: "PHONE_VERIFICATION_REQUIRED",
          },
          { status: 403 },
        );
      }
    } else if (!isAdmin && currentBalance < 1) {
      captureEvent(orgId, "account_creation_blocked", {
        reason: "insufficient_balance",
        balance: currentBalance,
      });
      return Response.json(
        {
          error: "Mailboxes cost $1/month. Please top up your balance.",
          code: "INSUFFICIENT_BALANCE",
        },
        { status: 402 },
      );
    }

    const now = Date.now();
    const expiresAt = now + planDetails.limits.trialDays * 24 * 60 * 60 * 1000;
    const accountId = id();

    // deno-lint-ignore no-explicit-any
    const txOps: any[] = [
      db.tx.accounts[accountId]!.update({
        address,
        displayName: (input.displayName ?? "").slice(0, 128),
        createdAt: now,
        expiresAt,
        isFrozen: false,
        sendsThisMonth: 0,
        sendPeriodStart: now,
      }),
      db.tx.accounts[accountId]!.link({ organization: orgId }),
    ];

    if (!isAdmin) {
      txOps.push(
        db.tx.organizations[orgId]!.update({
          balance: isTrial ? currentBalance : currentBalance - 1,
          ...(isTrial ? { trialUsed: true } : {}),
        }),
      );
    }

    await db.transact(txOps);

    captureEvent(orgId, "account_created", { accountId, isTrial });
    await notifyOverseer(address, input.displayName, orgId);
    if (isTrial) {
      trackBackgroundTask(
        sendTrialWelcomeEmail(org.billingUser?.email, address),
      );
    }

    return Response.json(
      {
        data: {
          id: accountId,
          address,
          displayName: input.displayName ?? null,
          expiresAt,
          isFrozen: false,
          sendsThisMonth: 0,
        },
      } satisfies ApiResponse<unknown>,
      { status: 201 },
    );
  });
};

const listAccounts = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { accounts } = await db.query({
    accounts: { $: { where: { "organization.id": orgId } } },
  });
  return Response.json(
    {
      data: accounts.map((a) => ({
        id: a.id,
        address: a.address,
        displayName: a.displayName || null,
        createdAt: a.createdAt,
        expiresAt: a.expiresAt,
        isFrozen: Boolean(a.isFrozen),
        sendsThisMonth: a.sendsThisMonth ?? 0,
      })),
    } satisfies ApiResponse<unknown>,
  );
};

const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

const messageRecipientCount = (m: {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
}): number =>
  Math.max(
    1,
    (Array.isArray(m.to) ? m.to.length : 1) +
      (Array.isArray(m.cc) ? m.cc.length : 0) +
      (Array.isArray(m.bcc) ? m.bcc.length : 0),
  );

const summarizeAccountUsage = (
  now: number,
  todayUtc: number,
  account: {
    sendsThisMonth?: number;
    sendPeriodStart?: number;
    messages?: {
      direction?: string;
      timestamp?: number;
      to?: unknown;
      cc?: unknown;
      bcc?: unknown;
    }[];
  },
) => {
  const msgs = account.messages ?? [];
  const sendsToday = msgs
    .filter((m) => m.direction === "outbound" && (m.timestamp ?? 0) >= todayUtc)
    .reduce((sum, m) => sum + messageRecipientCount(m), 0);
  const receivesToday = msgs.filter(
    (m) => m.direction === "inbound" && (m.timestamp ?? 0) >= todayUtc,
  ).length;
  const receivesThisMonth = msgs.filter(
    (m) => m.direction === "inbound",
  ).length;
  const isStalePeriod = !account.sendPeriodStart ||
    now - account.sendPeriodStart > thirtyDaysMs;
  const sendsThisMonth = isStalePeriod ? 0 : (account.sendsThisMonth ?? 0);
  return { sendsToday, sendsThisMonth, receivesToday, receivesThisMonth };
};

const getAccountsUsage = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const now = Date.now();
  const todayUtc = getUtcDayStart(new Date(now));
  const thirtyDaysAgo = now - thirtyDaysMs;
  const { accounts } = await db.query({
    accounts: {
      $: {
        where: { "organization.id": orgId },
        fields: ["sendsThisMonth", "sendPeriodStart"],
      },
      messages: {
        $: {
          where: { timestamp: { $gte: thirtyDaysAgo } },
          fields: ["direction", "timestamp", "to", "cc", "bcc"],
        },
      },
    },
  });
  const usageByAccount = Object.fromEntries(
    accounts.map((acc) => [
      acc.id,
      summarizeAccountUsage(now, todayUtc, acc),
    ]),
  );
  return Response.json(
    { data: usageByAccount } satisfies ApiResponse<unknown>,
  );
};

const getAccount = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  if (!params.accountId) {
    return Response.json(
      { error: "accountId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: params.accountId, "organization.id": orgId } },
    },
  });
  const account = accounts[0];
  if (!account) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  return Response.json(
    {
      data: {
        id: account.id,
        address: account.address,
        displayName: account.displayName || null,
        createdAt: account.createdAt,
        expiresAt: account.expiresAt,
        isFrozen: Boolean(account.isFrozen),
        sendsThisMonth: account.sendsThisMonth ?? 0,
      },
    } satisfies ApiResponse<unknown>,
  );
};

const deleteAccount = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  if (!params.accountId) {
    return Response.json(
      { error: "accountId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const { accounts } = await db.query({
    accounts: {
      $: {
        where: { id: params.accountId, "organization.id": orgId },
        fields: ["address"],
      },
      messages: {
        $: { fields: ["id"] },
        attachments: { $: { fields: ["storageKey"] } },
      },
    },
  });
  const account = accounts[0];
  if (!account) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const storageKeys = (account.messages ?? []).flatMap((m) =>
    (m.attachments ?? []).map((a) => a.storageKey).filter(Boolean)
  );
  if (storageKeys.length > 0 && Deno.env.get("DENO_ENV") !== "test") {
    await Promise.allSettled(storageKeys.map((key) => deleteFile(key)));
  }

  await db.transact([db.tx.accounts[account.id]!.delete()]);

  captureEvent(orgId, "account_deleted", { accountId: account.id });

  return new Response(null, { status: 204 });
};

export {
  createAccount,
  deleteAccount,
  getAccount,
  getAccountsUsage,
  listAccounts,
};
