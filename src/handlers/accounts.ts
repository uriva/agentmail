import { db, id } from "../db.ts";
import type { ApiResponse, CreateAccountInput } from "../types.ts";
import {
  recordKarmaEvent,
  requireKarmaForAccountCreation,
} from "../services/karma.ts";
import { emailDomain, sendEmail } from "../services/resend.ts";
import { captureEvent } from "../services/posthog.ts";

const RESERVED_KEYWORDS = [
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
  "billing",
  "verification",
  "official",
  "helpdesk",
  "service",
  "system",
  "notification",
  "alert",
  "verify",
  "uri",
];

const overseerEmail = Deno.env.get("OVERSEER_EMAIL") ?? "uri.valevski@gmail.com";

const notifyOverseer = (
  address: string,
  displayName: string | undefined,
  orgId: string,
) => {
  if (
    Deno.env.get("DENO_ENV") === "test" ||
    address.includes("test-") ||
    address.includes("simulated-") ||
    address.includes("free-agent-") ||
    !overseerEmail
  ) {
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
      const memberEmails =
        org?.members?.map((m) => m.email).filter(Boolean).join(", ") || "Unknown";
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
      console.error("[notifyOverseer] Failed to send notification email:", err),
    );
};

const isReservedOrSuspicious = (
  localPart: string,
  displayName?: string,
): boolean => {
  const normalizedPart = localPart.toLowerCase();
  const normalizedDisplay = (displayName ?? "").toLowerCase();
  return RESERVED_KEYWORDS.some(
    (kw) => normalizedPart.includes(kw) || normalizedDisplay.includes(kw),
  );
};

const createAccount = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const input = (await req.json()) as CreateAccountInput;
  const localPart = (
    input.address.includes("@") ? input.address.split("@")[0]! : input.address
  ).toLowerCase();
  const address = `${localPart}@${emailDomain}`;

  if (isReservedOrSuspicious(localPart, input.displayName)) {
    return Response.json(
      { error: "This address or display name is reserved or restricted", code: "RESERVED_ADDRESS" },
      { status: 400 },
    );
  }

  const { accounts: existingAccounts } = await db.query({
    accounts: { $: { where: { address } } },
  });
  if (existingAccounts.length > 0) {
    return Response.json(
      { error: "This email address is already in use", code: "ADDRESS_EXISTS" },
      { status: 409 },
    );
  }

  const { organizations } = await db.query({
    organizations: {
      $: { where: { id: orgId } },
      billingUser: {},
      members: {},
    },
  });
  const org = organizations[0];
  const isAdmin = Boolean(org?.admin) ||
    org?.billingUser?.email === "uri.valevski@gmail.com" ||
    org?.members?.some((m) => m.email === "uri.valevski@gmail.com");

  const currentBalance = org?.balance ?? 0;
  const isTrial = !isAdmin && !org?.trialUsed;

  if (isTrial) {
    const isPhoneVerified = Boolean(
      org?.billingUser?.phoneVerified ||
        org?.members?.some((m) => m.phoneVerified),
    );
    if (!isPhoneVerified) {
      captureEvent(orgId, "account_creation_blocked", {
        reason: "phone_verification_required",
        address,
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
  } else if (!isAdmin) {
    if (currentBalance < 1) {
      captureEvent(orgId, "account_creation_blocked", {
        reason: "insufficient_balance",
        balance: currentBalance,
        address,
      });
      return Response.json(
        {
          error:
            "Mailboxes cost $1/month. Please top up your balance.",
          code: "INSUFFICIENT_BALANCE",
        },
        { status: 402 },
      );
    }
  }

  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  const accountId = id();

  // deno-lint-ignore no-explicit-any
  const txOps: any[] = [
    db.tx.accounts[accountId]!.update({
      address,
      displayName: input.displayName ?? "",
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

  await recordKarmaEvent(orgId, "account_created", { accountId, address });
  captureEvent(orgId, "account_created", { address });
  await notifyOverseer(address, input.displayName, orgId);

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

const getAccount = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: params.accountId!, "organization.id": orgId } },
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
  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: params.accountId!, "organization.id": orgId } },
    },
  });
  const account = accounts[0];
  if (!account) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await db.transact([db.tx.accounts[account.id]!.delete()]);

  await recordKarmaEvent(orgId, "account_deleted", {
    accountId: account.id,
    address: account.address,
  });
  captureEvent(orgId, "account_deleted", { address: account.address });

  return new Response(null, { status: 204 });
};

export { createAccount, deleteAccount, getAccount, listAccounts };
