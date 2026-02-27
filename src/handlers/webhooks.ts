import { db, id } from "../db.ts";
import type { CreateWebhookInput, ApiResponse } from "../types.ts";

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
  const accountId = params.accountId!;

  // Verify account belongs to org
  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId, "organization.id": orgId } },
    },
  });
  if (!accounts[0]) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const input = (await req.json()) as CreateWebhookInput;
  const secret = input.secret ?? generateSecret();
  const webhookId = id();

  await db.transact([
    db.tx.webhookSubscriptions[webhookId]!.update({
      url: input.url,
      secret,
      active: true,
      createdAt: Date.now(),
    }),
    db.tx.webhookSubscriptions[webhookId]!.link({ account: accountId }),
  ]);

  return Response.json(
    {
      data: { id: webhookId, url: input.url, secret, active: true },
    } satisfies ApiResponse<unknown>,
    { status: 201 },
  );
};

const listWebhooks = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId!;

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

  return Response.json({
    data: accounts[0].webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      active: w.active,
      createdAt: w.createdAt,
    })),
  } satisfies ApiResponse<unknown>);
};

const deleteWebhook = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId!;
  const webhookId = params.webhookId!;

  // Verify account belongs to org
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

export { createWebhook, listWebhooks, deleteWebhook };
