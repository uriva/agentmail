import { db, id } from "../db.ts";

const generateApiKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "am_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
};

const hashKey = async (key: string): Promise<string> => {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const createApiKey = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  // This endpoint uses InstantDB user token auth (not API key auth)
  // The orgId will be resolved from the user token inside main.ts
  // and passed as _orgId. But we also need the user-provided name.
  const body = await req.json();
  const name = body.name || "Default";
  const orgId = _orgId;

  if (!orgId) {
    return Response.json(
      { error: "No organization found", code: "NO_ORG" },
      { status: 400 },
    );
  }

  const plainKey = generateApiKey();
  const keyHash = await hashKey(plainKey);
  const prefix = plainKey.slice(0, 10);

  const keyId = id();
  await db.transact([
    db.tx.apiKeys[keyId]!.update({
      keyHash,
      prefix,
      name,
      createdAt: Date.now(),
    }),
    db.tx.apiKeys[keyId]!.link({ organization: orgId }),
  ]);

  return Response.json({
    data: {
      id: keyId,
      key: plainKey,
      prefix,
      name,
      createdAt: Date.now(),
    },
  });
};

export const listApiKeys = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { apiKeys } = await db.query({
    apiKeys: { $: { where: { "organization.id": orgId } } },
  });

  return Response.json({
    data: apiKeys.map((k) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    })),
  });
};

export const deleteApiKey = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { apiKeyId } = params;

  // Verify key belongs to this org
  const { apiKeys } = await db.query({
    apiKeys: {
      $: { where: { id: apiKeyId, "organization.id": orgId } },
    },
  });

  if (apiKeys.length === 0) {
    return Response.json(
      { error: "API key not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await db.transact([db.tx.apiKeys[apiKeyId]!.delete()]);

  return Response.json({ data: { deleted: true } });
};
