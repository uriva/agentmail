import { resolve } from "node:path";
import { db } from "./db.ts";
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
} from "./handlers/accounts.ts";
import {
  createAccountApiKey,
  createApiKey,
  deleteApiKey,
  listApiKeys,
} from "./handlers/apiKeys.ts";
import { getAttachmentUrl } from "./handlers/attachments.ts";
import {
  createCheckout,
  getBillingBalance,
  handleStripeWebhook,
  syncCheckout,
} from "./handlers/billing.ts";
import { handleInbound } from "./handlers/inbound.ts";
import { inviteMember, listMembers, removeMember } from "./handlers/members.ts";
import { getMessage, listMessages, sendMessage } from "./handlers/messages.ts";
import {
  createOrganization,
  listOrganizations,
  renameOrganization,
} from "./handlers/organizations.ts";
import {
  getPhoneStatus,
  sendPhoneCode,
  verifyPhoneCode,
} from "./handlers/phoneVerification.ts";
import {
  handleLookupMailbox,
  handleLookupUser,
  handleSupportPrompt,
} from "./handlers/supportBot.ts";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
} from "./handlers/webhooks.ts";
import { trackBackgroundTask } from "./services/posthog.ts";
import type { ApiError } from "./types.ts";

type AuthType =
  | "accountApiKey"
  | "apiKeyOrUserToken"
  | "orgApiKeyOrUserToken"
  | "userToken"
  | "userTokenOptionalOrg"
  | "none";

type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  orgId: string,
  accountId?: string,
) => Promise<Response>;

type Route = {
  readonly method: string;
  readonly pattern: URLPattern;
  readonly handler: RouteHandler;
  readonly authType: AuthType;
};

const hashApiKey = async (key: string): Promise<string> => {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const authenticateApiKey = async (
  req: Request,
): Promise<{ orgId: string; accountId: string | null } | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith("am_")) return null;
  const keyHash = await hashApiKey(apiKey);

  const { apiKeys } = await db.query({
    apiKeys: {
      $: { where: { keyHash } },
      organization: {},
      account: {},
    },
  });

  const apiKeyRecord = apiKeys[0];
  if (!apiKeyRecord?.organization) return null;

  trackBackgroundTask(
    db.transact([
      db.tx.apiKeys[apiKeyRecord.id]!.update({ lastUsedAt: Date.now() }),
    ]),
  );

  return {
    orgId: apiKeyRecord.organization.id,
    accountId: apiKeyRecord.account?.id ?? null,
  };
};

const authenticateUserToken = async (
  req: Request,
): Promise<string | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (token.startsWith("am_")) return null;

  try {
    const user = await db.auth.verifyToken(token);
    if (!user?.id) return null;

    const orgId = req.headers.get("x-org-id");
    if (!orgId) return null;

    const { organizations } = await db.query({
      organizations: {
        $: { where: { id: orgId, "members.id": user.id } },
      },
    });

    return organizations.length > 0 ? orgId : null;
  } catch {
    return null;
  }
};

const route = (
  method: string,
  path: string,
  handler: RouteHandler,
  authType: AuthType = "accountApiKey",
): Route => ({
  method,
  pattern: new URLPattern({ pathname: path }),
  handler,
  authType,
});

const routes: readonly Route[] = [
  // Organization-level account management (rejects account-scoped API keys)
  route("POST", "/v1/accounts", createAccount, "orgApiKeyOrUserToken"),
  route("GET", "/v1/accounts", listAccounts, "orgApiKeyOrUserToken"),
  route("GET", "/v1/accounts/:accountId", getAccount, "apiKeyOrUserToken"),
  route(
    "DELETE",
    "/v1/accounts/:accountId",
    deleteAccount,
    "orgApiKeyOrUserToken",
  ),

  // Messages
  route(
    "POST",
    "/v1/accounts/:accountId/messages",
    sendMessage,
    "apiKeyOrUserToken",
  ),
  route(
    "GET",
    "/v1/accounts/:accountId/messages",
    listMessages,
    "apiKeyOrUserToken",
  ),
  route(
    "GET",
    "/v1/accounts/:accountId/messages/:messageId",
    getMessage,
    "apiKeyOrUserToken",
  ),

  // Attachments
  route(
    "GET",
    "/v1/accounts/:accountId/messages/:messageId/attachments/:attachmentId",
    getAttachmentUrl,
    "apiKeyOrUserToken",
  ),

  // Webhooks
  route(
    "POST",
    "/v1/accounts/:accountId/webhooks",
    createWebhook,
    "apiKeyOrUserToken",
  ),
  route(
    "GET",
    "/v1/accounts/:accountId/webhooks",
    listWebhooks,
    "apiKeyOrUserToken",
  ),
  route(
    "DELETE",
    "/v1/accounts/:accountId/webhooks/:webhookId",
    deleteWebhook,
    "apiKeyOrUserToken",
  ),

  // Account-scoped shortcuts (strictly require an account-scoped API key)
  route("GET", "/v1/account", getAccount, "accountApiKey"),
  route("DELETE", "/v1/account", deleteAccount, "accountApiKey"),
  route("POST", "/v1/messages", sendMessage, "accountApiKey"),
  route("GET", "/v1/messages", listMessages, "accountApiKey"),
  route("GET", "/v1/messages/:messageId", getMessage, "accountApiKey"),
  route(
    "GET",
    "/v1/messages/:messageId/attachments/:attachmentId",
    getAttachmentUrl,
    "accountApiKey",
  ),
  route("POST", "/v1/webhooks", createWebhook, "accountApiKey"),
  route("GET", "/v1/webhooks", listWebhooks, "accountApiKey"),
  route("DELETE", "/v1/webhooks/:webhookId", deleteWebhook, "accountApiKey"),

  // Billing (org-level only)
  route(
    "POST",
    "/v1/billing/checkout",
    createCheckout,
    "orgApiKeyOrUserToken",
  ),
  route("POST", "/v1/billing/sync", syncCheckout, "orgApiKeyOrUserToken"),
  route(
    "GET",
    "/v1/billing/balance",
    getBillingBalance,
    "orgApiKeyOrUserToken",
  ),

  // API Keys (user-token auth — from dashboard)
  route("POST", "/v1/api-keys", createApiKey, "userToken"),
  route("GET", "/v1/api-keys", listApiKeys, "userToken"),
  route("DELETE", "/v1/api-keys/:apiKeyId", deleteApiKey, "userToken"),

  // Account API Keys (org-level only so account-scoped keys cannot mint new keys)
  route(
    "POST",
    "/v1/accounts/:accountId/api-keys",
    createAccountApiKey,
    "orgApiKeyOrUserToken",
  ),

  // Phone Verification
  route("POST", "/v1/phone/send-code", sendPhoneCode, "userTokenOptionalOrg"),
  route(
    "POST",
    "/v1/phone/verify-code",
    verifyPhoneCode,
    "userTokenOptionalOrg",
  ),
  route("GET", "/v1/phone/status", getPhoneStatus, "userTokenOptionalOrg"),

  // Organizations
  route(
    "POST",
    "/v1/organizations",
    createOrganization,
    "userTokenOptionalOrg",
  ),
  route("GET", "/v1/organizations", listOrganizations, "userTokenOptionalOrg"),
  route("PATCH", "/v1/organizations", renameOrganization, "userToken"),

  // Members
  route("POST", "/v1/members", inviteMember, "userToken"),
  route("GET", "/v1/members", listMembers, "userToken"),
  route("DELETE", "/v1/members/:memberId", removeMember, "userToken"),

  // Inbound (verified via Svix / ForwardEmail webhook signature)
  route("POST", "/inbound", handleInbound, "none"),

  // Stripe Webhook
  route("POST", "/stripe-webhook", handleStripeWebhook, "none"),
  route("POST", "/v1/billing/stripe-webhook", handleStripeWebhook, "none"),

  // Support Bot (verified via HMAC signature with SUPPORT_BOT_SECRET)
  route("GET", "/v1/support/prompt", handleSupportPrompt, "none"),
  route("POST", "/v1/support/prompt", handleSupportPrompt, "none"),
  route("POST", "/v1/support/tools/lookup-user", handleLookupUser, "none"),
  route(
    "POST",
    "/v1/support/tools/lookup-mailbox",
    handleLookupMailbox,
    "none",
  ),

  // Health
  route(
    "GET",
    "/health",
    () => Promise.resolve(Response.json({ status: "ok" })),
    "none",
  ),
];

export const baseSecurityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const allowedDashboardOrigins = new Set([
  "https://theagentmail.net",
  "https://www.theagentmail.net",
  "http://localhost:3000",
  "http://localhost:8000",
]);

const buildCorsHeaders = (
  req: Request,
  isDashboardRoute: boolean,
): Record<string, string> => {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = isDashboardRoute
    ? (allowedDashboardOrigins.has(origin)
      ? origin
      : "https://theagentmail.net")
    : "*";
  return {
    ...baseSecurityHeaders,
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Org-Id",
    ...(isDashboardRoute ? { Vary: "Origin" } : {}),
  };
};

const jsonError = (
  req: Request,
  status: number,
  error: string,
  code: string,
  isDashboardRoute = false,
): Response =>
  Response.json({ error, code } satisfies ApiError, {
    status,
    headers: buildCorsHeaders(req, isDashboardRoute),
  });

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
): Promise<{
  orgId: string | null;
  accountId: string | null;
  error: Response | null;
}> => {
  if (authType === "none") {
    return { orgId: "", accountId: null, error: null };
  }

  if (authType === "accountApiKey") {
    const result = await authenticateApiKey(req);
    if (!result) {
      return {
        orgId: null,
        accountId: null,
        error: jsonError(
          req,
          401,
          "Invalid or missing API key",
          "UNAUTHORIZED",
        ),
      };
    }
    if (!result.accountId) {
      return {
        orgId: null,
        accountId: null,
        error: jsonError(
          req,
          403,
          "Shortcut routes require an account-scoped API key; use /v1/accounts/:accountId/... with org-scoped keys",
          "FORBIDDEN",
        ),
      };
    }
    return { orgId: result.orgId, accountId: result.accountId, error: null };
  }

  if (authType === "orgApiKeyOrUserToken") {
    const apiKeyResult = await authenticateApiKey(req);
    if (apiKeyResult) {
      if (apiKeyResult.accountId !== null) {
        return {
          orgId: null,
          accountId: null,
          error: jsonError(
            req,
            403,
            "Account-scoped API keys cannot perform organization-level operations",
            "FORBIDDEN",
          ),
        };
      }
      return { orgId: apiKeyResult.orgId, accountId: null, error: null };
    }
    const orgId = await authenticateUserToken(req);
    return orgId ? { orgId, accountId: null, error: null } : {
      orgId: null,
      accountId: null,
      error: jsonError(
        req,
        401,
        "Invalid or missing credentials",
        "UNAUTHORIZED",
      ),
    };
  }

  if (authType === "apiKeyOrUserToken") {
    const apiKeyResult = await authenticateApiKey(req);
    if (apiKeyResult) {
      return {
        orgId: apiKeyResult.orgId,
        accountId: apiKeyResult.accountId,
        error: null,
      };
    }
    const orgId = await authenticateUserToken(req);
    return orgId ? { orgId, accountId: null, error: null } : {
      orgId: null,
      accountId: null,
      error: jsonError(
        req,
        401,
        "Invalid or missing credentials",
        "UNAUTHORIZED",
      ),
    };
  }

  if (authType === "userToken") {
    const orgId = await authenticateUserToken(req);
    return orgId ? { orgId, accountId: null, error: null } : {
      orgId: null,
      accountId: null,
      error: jsonError(
        req,
        401,
        "Invalid or missing user token",
        "UNAUTHORIZED",
        true,
      ),
    };
  }

  // userTokenOptionalOrg
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      orgId: null,
      accountId: null,
      error: jsonError(req, 401, "Missing authorization", "UNAUTHORIZED", true),
    };
  }
  const token = authHeader.slice(7);
  try {
    const user = await db.auth.verifyToken(token);
    if (!user?.id) throw new Error("No user");
    const { organizations } = await db.query({
      organizations: { $: { where: { "members.id": user.id } } },
    });
    return {
      orgId: organizations[0]?.id ?? "",
      accountId: null,
      error: null,
    };
  } catch {
    return {
      orgId: null,
      accountId: null,
      error: jsonError(req, 401, "Invalid user token", "UNAUTHORIZED", true),
    };
  }
};

const handleRequest = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") ?? "";
    const isDashOrigin = allowedDashboardOrigins.has(origin);
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(req, isDashOrigin),
    });
  }

  const matched = matchRoute(req);
  if (!matched) {
    return jsonError(req, 404, "Not found", "NOT_FOUND");
  }

  const { route: matchedRoute, params } = matched;
  const isDashboardRoute = matchedRoute.authType === "userToken" ||
    matchedRoute.authType === "userTokenOptionalOrg";

  const { orgId, accountId, error: authError } = await resolveAuth(
    req,
    matchedRoute.authType,
  );
  if (authError) return authError;

  if (accountId) {
    const routeAccountId = params.accountId;
    if (routeAccountId && routeAccountId !== accountId) {
      return jsonError(
        req,
        403,
        "Account-scoped token cannot access other accounts",
        "FORBIDDEN",
      );
    }
    if (!routeAccountId) {
      params.accountId = accountId;
    }
  }

  try {
    const response = await matchedRoute.handler(
      req,
      params,
      orgId!,
      accountId ?? undefined,
    );
    for (
      const [key, value] of Object.entries(
        buildCorsHeaders(req, isDashboardRoute),
      )
    ) {
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
      return jsonError(req, e.status, e.error, e.code, isDashboardRoute);
    }
    console.error("Unhandled error:", err);
    return jsonError(
      req,
      500,
      "Internal server error",
      "INTERNAL_ERROR",
      isDashboardRoute,
    );
  }
};

const distDir = import.meta.url
  ? resolve(new URL("../web/dist", import.meta.url).pathname)
  : "/web/dist";

const contentTypeByExt: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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

const resolveSafeDistPath = (relativePath: string): string | null => {
  const candidate = resolve(distDir, `.${relativePath}`);
  return candidate === distDir || candidate.startsWith(`${distDir}/`)
    ? candidate
    : null;
};

const serveStaticFile = async (filePath: string): Promise<Response | null> => {
  try {
    const data = await Deno.readFile(filePath);
    const isAsset = filePath.includes("/assets/");
    return new Response(data, {
      headers: {
        ...baseSecurityHeaders,
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
  const decoded = (() => {
    try {
      return decodeURIComponent(url.pathname);
    } catch {
      return null;
    }
  })();
  if (!decoded || decoded.includes("\0")) return null;

  const exactPath = resolveSafeDistPath(decoded);
  if (exactPath) {
    const fileResponse = await serveStaticFile(exactPath);
    if (fileResponse) return fileResponse;
  }

  const indexCandidate = resolveSafeDistPath(`${decoded}/index.html`);
  if (indexCandidate) {
    const prerenderResponse = await serveStaticFile(indexCandidate);
    if (prerenderResponse) return prerenderResponse;
  }

  return serveStaticFile(`${distDir}/index.html`);
};

export const isApiPath = (pathname: string): boolean =>
  pathname.startsWith("/v1/") ||
  pathname === "/inbound" ||
  pathname === "/stripe-webhook" ||
  pathname === "/health";

const handler = async (req: Request): Promise<Response> => {
  const response = await handleRequest(req);
  if (response.status === 404) {
    const url = new URL(req.url);
    if (
      !isApiPath(url.pathname) &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      const staticResponse = await handleStatic(req);
      if (staticResponse) return staticResponse;
    }
  }
  return response;
};

export { handleRequest };

if (import.meta.main) {
  Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8000) }, handler);
}
