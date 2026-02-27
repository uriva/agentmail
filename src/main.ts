import { db } from "./db.ts";
import type { ApiError } from "./types.ts";

// Handlers
import {
  createAccount,
  listAccounts,
  getAccount,
  deleteAccount,
} from "./handlers/accounts.ts";
import { sendMessage, listMessages, getMessage } from "./handlers/messages.ts";
import { getAttachmentUrl } from "./handlers/attachments.ts";
import { getKarmaBalance } from "./handlers/karma.ts";
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
} from "./handlers/webhooks.ts";
import { handleInbound } from "./handlers/inbound.ts";
import {
  createApiKey,
  listApiKeys,
  deleteApiKey,
} from "./handlers/apiKeys.ts";
import { createOrganization } from "./handlers/organizations.ts";

// --- Types ---

type AuthType = "apiKey" | "userToken" | "userTokenOptionalOrg" | "none";

type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  orgId: string,
) => Promise<Response>;

type Route = {
  readonly method: string;
  readonly pattern: URLPattern;
  readonly handler: RouteHandler;
  readonly authType: AuthType;
};

// --- Auth ---

const hashApiKey = async (key: string): Promise<string> => {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const authenticateApiKey = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  const keyHash = await hashApiKey(apiKey);

  const { apiKeys } = await db.query({
    apiKeys: {
      $: { where: { keyHash } },
      organization: {},
    },
  });

  const apiKeyRecord = apiKeys[0];
  if (!apiKeyRecord?.organization) return null;

  // Update lastUsedAt (fire and forget)
  db.transact([
    db.tx.apiKeys[apiKeyRecord.id]!.update({ lastUsedAt: Date.now() }),
  ]);

  return apiKeyRecord.organization.id;
};

const authenticateUserToken = async (
  req: Request,
): Promise<string | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  try {
    const user = await db.auth.verifyToken(token);
    if (!user?.id) return null;

    // Find the user's organization
    const { organizations } = await db.query({
      organizations: {
        $: { where: { "members.id": user.id } },
      },
    });

    const org = organizations[0];
    return org?.id ?? null;
  } catch {
    return null;
  }
};

// --- Routes ---

const route = (
  method: string,
  path: string,
  handler: RouteHandler,
  authType: AuthType = "apiKey",
): Route => ({
  method,
  pattern: new URLPattern({ pathname: path }),
  handler,
  authType,
});

const routes: readonly Route[] = [
  // Accounts
  route("POST", "/v1/accounts", createAccount),
  route("GET", "/v1/accounts", listAccounts),
  route("GET", "/v1/accounts/:accountId", getAccount),
  route("DELETE", "/v1/accounts/:accountId", deleteAccount),

  // Messages
  route("POST", "/v1/accounts/:accountId/messages", sendMessage),
  route("GET", "/v1/accounts/:accountId/messages", listMessages),
  route(
    "GET",
    "/v1/accounts/:accountId/messages/:messageId",
    getMessage,
  ),

  // Attachments
  route(
    "GET",
    "/v1/accounts/:accountId/messages/:messageId/attachments/:attachmentId",
    getAttachmentUrl,
  ),

  // Webhooks
  route("POST", "/v1/accounts/:accountId/webhooks", createWebhook),
  route("GET", "/v1/accounts/:accountId/webhooks", listWebhooks),
  route(
    "DELETE",
    "/v1/accounts/:accountId/webhooks/:webhookId",
    deleteWebhook,
  ),

  // Karma
  route("GET", "/v1/karma", getKarmaBalance),

  // API Keys (user-token auth — from dashboard)
  route("POST", "/v1/api-keys", createApiKey, "userToken"),
  route("GET", "/v1/api-keys", listApiKeys, "userToken"),
  route("DELETE", "/v1/api-keys/:apiKeyId", deleteApiKey, "userToken"),

  // Organizations (user-token auth — org may not exist yet)
  route("POST", "/v1/organizations", createOrganization, "userTokenOptionalOrg"),

  // Inbound (from Forward Email, no auth — uses webhook secret)
  route("POST", "/inbound", handleInbound, "none"),

  // Health
  route(
    "GET",
    "/health",
    async () => Response.json({ status: "ok" }),
    "none",
  ),
];

// --- Error handling ---

const jsonError = (status: number, error: string, code: string): Response =>
  Response.json({ error, code } satisfies ApiError, { status });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// --- Request handler ---

const matchRoute = (
  req: Request,
): { route: Route; params: Record<string, string> } | null => {
  const method = req.method;
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(req.url);
    if (match) {
      return {
        route: r,
        params: (match.pathname.groups ?? {}) as Record<string, string>,
      };
    }
  }
  return null;
};

const resolveAuth = async (
  req: Request,
  authType: AuthType,
): Promise<{ orgId: string | null; error: Response | null }> => {
  switch (authType) {
    case "none":
      return { orgId: "", error: null };
    case "apiKey": {
      const orgId = await authenticateApiKey(req);
      return orgId
        ? { orgId, error: null }
        : {
            orgId: null,
            error: jsonError(401, "Invalid or missing API key", "UNAUTHORIZED"),
          };
    }
    case "userToken": {
      const orgId = await authenticateUserToken(req);
      return orgId
        ? { orgId, error: null }
        : {
            orgId: null,
            error: jsonError(
              401,
              "Invalid or missing user token",
              "UNAUTHORIZED",
            ),
          };
    }
    case "userTokenOptionalOrg": {
      // Verify the user token is valid but don't require an org
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return {
          orgId: null,
          error: jsonError(401, "Missing authorization", "UNAUTHORIZED"),
        };
      }
      const token = authHeader.slice(7);
      try {
        const user = await db.auth.verifyToken(token);
        if (!user?.id) throw new Error("No user");
        // Try to find org, but it's okay if there isn't one
        const { organizations } = await db.query({
          organizations: { $: { where: { "members.id": user.id } } },
        });
        return { orgId: organizations[0]?.id ?? "", error: null };
      } catch {
        return {
          orgId: null,
          error: jsonError(401, "Invalid user token", "UNAUTHORIZED"),
        };
      }
    }
  }
};

const handleRequest = async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const matched = matchRoute(req);
  if (!matched) {
    return jsonError(404, "Not found", "NOT_FOUND");
  }

  const { route: matchedRoute, params } = matched;

  // Auth
  const { orgId, error: authError } = await resolveAuth(
    req,
    matchedRoute.authType,
  );
  if (authError) return authError;

  try {
    const response = await matchedRoute.handler(req, params, orgId!);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      "error" in err &&
      "code" in err
    ) {
      const e = err as { status: number; error: string; code: string };
      return jsonError(e.status, e.error, e.code);
    }
    console.error("Unhandled error:", err);
    return jsonError(500, "Internal server error", "INTERNAL_ERROR");
  }
};

// --- Static file serving ---

const DIST_DIR = new URL("../web/dist", import.meta.url).pathname;

const contentTypeByExt: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const getContentType = (path: string): string => {
  const ext = path.slice(path.lastIndexOf("."));
  return contentTypeByExt[ext] ?? "application/octet-stream";
};

const serveStaticFile = async (filePath: string): Promise<Response | null> => {
  try {
    const data = await Deno.readFile(filePath);
    const isAsset = filePath.includes("/assets/");
    return new Response(data, {
      headers: {
        "content-type": getContentType(filePath),
        ...(isAsset
          ? { "cache-control": "public, max-age=31536000, immutable" }
          : { "cache-control": "no-cache" }),
      },
    });
  } catch {
    return null;
  }
};

const handleStatic = async (req: Request): Promise<Response | null> => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Try exact file match
  const filePath = `${DIST_DIR}${pathname}`;
  const fileResponse = await serveStaticFile(filePath);
  if (fileResponse) return fileResponse;

  // SPA fallback — serve index.html for non-file paths
  return serveStaticFile(`${DIST_DIR}/index.html`);
};

// --- Start server ---

const handler = async (req: Request): Promise<Response> => {
  const response = await handleRequest(req);
  // If API returned 404 and this isn't an API path, try static files
  if (response.status === 404) {
    const url = new URL(req.url);
    const isApiPath =
      url.pathname.startsWith("/v1/") ||
      url.pathname === "/inbound" ||
      url.pathname === "/health";
    if (!isApiPath && req.method === "GET") {
      const staticResponse = await handleStatic(req);
      if (staticResponse) return staticResponse;
    }
  }
  return response;
};

Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8000) }, handler);
