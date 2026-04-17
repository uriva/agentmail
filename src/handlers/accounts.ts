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
} from "../services/forwardEmail.ts";
import { captureEvent } from "../services/posthog.ts";

const WEBHOOK_RECEIVER_URL = Deno.env.get("INBOUND_WEBHOOK_URL") ??
  "https://api.theagentmail.net/inbound";

const RESERVED_ADDRESSES = new Set(["uri", "support"]);

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

  if (RESERVED_ADDRESSES.has(localPart.toLowerCase())) {
    return Response.json(
      { error: "This address is reserved", code: "RESERVED_ADDRESS" },
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
