import { db, id } from "../db.ts";
import { validateWebhookTargetUrl } from "../security.ts";
import type { ApiResponse, CreateWebhookInput } from "../types.ts";

const maxWebhooksPerAccount = 5;

const generateSecret = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const createWebhook = async (
  req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId;
  if (!accountId) {
    return Response.json(
      { error: "accountId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId, "organization.id": orgId } },
      webhooks: {},
    },
  });
  const account = accounts[0];
  if (!account) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if ((account.webhooks?.length ?? 0) >= maxWebhooksPerAccount) {
    return Response.json(
      {
        error:
          `Maximum of ${maxWebhooksPerAccount} webhooks per mailbox reached`,
        code: "WEBHOOK_LIMIT_REACHED",
      },
      { status: 400 },
    );
  }

  const input = (await req.json()) as CreateWebhookInput;
  const validatedUrl = validateWebhookTargetUrl(input?.url ?? "");
  if (!validatedUrl) {
    return Response.json(
      {
        error: "Webhook URL must be a valid public HTTPS URL",
        code: "INVALID_WEBHOOK_URL",
      },
      { status: 400 },
    );
  }

  const secret = input.secret && input.secret.length >= 16
    ? input.secret
    : generateSecret();
  const webhookId = id();

  await db.transact([
    db.tx.webhookSubscriptions[webhookId]!.update({
      url: validatedUrl,
      secret,
      active: true,
      createdAt: Date.now(),
    }),
    db.tx.webhookSubscriptions[webhookId]!.link({ account: accountId }),
  ]);

  return Response.json(
    {
      data: { id: webhookId, url: validatedUrl, secret, active: true },
    } satisfies ApiResponse<unknown>,
    { status: 201 },
  );
};

const listWebhooks = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId;
  if (!accountId) {
    return Response.json(
      { error: "accountId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId, "organization.id": orgId } },
      webhooks: {},
    },
  });
  if (!accounts[0]) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json(
    {
      data: accounts[0].webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        active: w.active,
        createdAt: w.createdAt,
      })),
    } satisfies ApiResponse<unknown>,
  );
};

const deleteWebhook = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId;
  const webhookId = params.webhookId;
  if (!accountId || !webhookId) {
    return Response.json(
      { error: "accountId and webhookId are required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId, "organization.id": orgId } },
      webhooks: { $: { where: { id: webhookId } } },
    },
  });
  if (!accounts[0]) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  if (!accounts[0].webhooks[0]) {
    return Response.json(
      { error: "Webhook not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await db.transact([db.tx.webhookSubscriptions[webhookId]!.delete()]);
  return new Response(null, { status: 204 });
};

export { createWebhook, deleteWebhook, listWebhooks };
