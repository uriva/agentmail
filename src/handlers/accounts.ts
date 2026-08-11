import { db, id } from "../db.ts";
import type { ApiResponse, CreateAccountInput } from "../types.ts";
import {
  recordKarmaEvent,
  requireKarmaForAccountCreation,
} from "../services/karma.ts";
import {
  createAlias,
  deleteAlias,
  FORWARD_EMAIL_DOMAIN,
  sendEmail,
} from "../services/forwardEmail.ts";
import { captureEvent } from "../services/posthog.ts";

const WEBHOOK_RECEIVER_URL = Deno.env.get("INBOUND_WEBHOOK_URL") ??
  "https://api.theagentmail.net/inbound";

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
) =>
  db
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
      const memberEmails =
        org?.members?.map((m) => m.email).filter(Boolean).join(", ") || "Unknown";
      return sendEmail({
        from: `notifications@${FORWARD_EMAIL_DOMAIN}`,
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
  const address = `${localPart}@${FORWARD_EMAIL_DOMAIN}`;

  if (isReservedOrSuspicious(localPart, input.displayName)) {
    return Response.json(
      { error: "This address or display name is reserved or restricted", code: "RESERVED_ADDRESS" },
      { status: 400 },
    );
  }

  await requireKarmaForAccountCreation(orgId);

  // Create alias in Forward Email pointing to our inbound webhook
  await createAlias(localPart, [WEBHOOK_RECEIVER_URL]);

  const accountId = id();
  await db.transact([
    db.tx.accounts[accountId]!.update({
      address,
      displayName: input.displayName ?? "",
      createdAt: Date.now(),
    }),
    db.tx.accounts[accountId]!.link({ organization: orgId }),
  ]);

  await recordKarmaEvent(orgId, "account_created", { accountId, address });
  captureEvent(orgId, "account_created", { address });
  await notifyOverseer(address, input.displayName, orgId);

  return Response.json(
    {
      data: { id: accountId, address, displayName: input.displayName ?? null },
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

  const localPart = account.address.split("@")[0]!;
  try {
    await deleteAlias(localPart);
  } catch {
    // Alias may not exist in Forward Email, proceed with local deletion
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
