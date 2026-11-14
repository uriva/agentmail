import { db } from "../db.ts";
import { generateSupportPrompt } from "../planData.ts";
import {
  hmacSha256Hex,
  markWebhookEventSeen,
  timingSafeEqualStrings,
} from "../security.ts";

const maxSkewMs = 5 * 60 * 1000;

const parseBody = async (req: Request): Promise<Record<string, unknown>> => {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null &&
        !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const extractParams = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const payload = body.payload as Record<string, unknown> | undefined;
  if (payload && typeof payload === "object" && payload.params) {
    return payload.params as Record<string, unknown>;
  }
  if (body.params && typeof body.params === "object") {
    return body.params as Record<string, unknown>;
  }
  return body;
};

export const verifySupportBotSignature = async (
  body: Record<string, unknown>,
): Promise<boolean> => {
  const secret = Deno.env.get("SUPPORT_BOT_SECRET") ?? "";
  if (!secret) return false;
  const signature = body.signature;
  const payload = body.payload;
  if (typeof signature !== "string" || !signature || payload === undefined) {
    return false;
  }

  if (typeof payload === "object" && payload !== null) {
    const meta = (payload as Record<string, unknown>).meta as
      | Record<string, unknown>
      | undefined;
    if (meta?.timestamp !== undefined) {
      const ts = Number(meta.timestamp);
      if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkewMs) {
        return false;
      }
    }
    if (typeof meta?.nonce === "string" && meta.nonce.length > 0) {
      if (!markWebhookEventSeen(`support:${meta.nonce}`, maxSkewMs)) {
        return false;
      }
    }
  }

  const expected = await hmacSha256Hex(secret, JSON.stringify(payload));
  return timingSafeEqualStrings(signature.toLowerCase(), expected);
};

const normalizeAddress = (raw: string): string => {
  const cleaned = raw.includes("<") ? raw.match(/<(.+)>/)?.[1] ?? raw : raw;
  const lower = cleaned.toLowerCase().trim();
  return lower.includes("@") ? lower : `${lower}@theagentmail.net`;
};

const redactWebhookHost = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "invalid-url";
  }
};

export const handleSupportPrompt = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await parseBody(req);
  if (!await verifySupportBotSignature(body)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(generateSupportPrompt(), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

export const handleLookupUser = async (req: Request): Promise<Response> => {
  const body = await parseBody(req);
  if (!await verifySupportBotSignature(body)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = extractParams(body);
  const email = (params.email as string | undefined)?.toLowerCase().trim();
  if (!email) {
    return Response.json({ error: "Email parameter required" }, {
      status: 400,
    });
  }

  const { $users } = await db.query({
    $users: {
      $: { where: { email } },
      organizations: {
        accounts: {
          webhooks: {},
        },
        billingUser: {},
        members: {},
      },
    },
  });

  const user = $users[0];
  if (!user) {
    const { organizations } = await db.query({
      organizations: {
        $: { where: { "members.email": email } },
        billingUser: {},
        members: {},
        accounts: { webhooks: {} },
      },
    });
    const org = organizations[0];
    if (!org) {
      return Response.json({
        found: false,
        message: `No user or organization found for ${email}`,
      });
    }
    return Response.json({
      found: true,
      email,
      organization: {
        id: org.id,
        name: org.name,
        balanceDollars: org.balance ?? 0,
        trialUsed: Boolean(org.trialUsed),
        isAdmin: Boolean(org.admin),
      },
      mailboxes: (org.accounts ?? []).map((acc) => ({
        id: acc.id,
        address: acc.address,
        displayName: acc.displayName ?? "",
        isFrozen: Boolean(acc.isFrozen),
        sendsThisMonth: acc.sendsThisMonth ?? 0,
        expiresAt: acc.expiresAt ? new Date(acc.expiresAt).toISOString() : null,
        activeWebhooksCount: (acc.webhooks ?? []).filter((w) =>
          w.active
        ).length,
      })),
    });
  }

  const org = user.organizations?.[0];

  return Response.json({
    found: true,
    email,
    phoneVerified: Boolean(user.phoneVerified),
    organization: org
      ? {
        id: org.id,
        name: org.name,
        balanceDollars: org.balance ?? 0,
        trialUsed: Boolean(org.trialUsed),
        isAdmin: Boolean(org.admin),
      }
      : null,
    mailboxes: (org?.accounts ?? []).map((acc) => ({
      id: acc.id,
      address: acc.address,
      displayName: acc.displayName ?? "",
      isFrozen: Boolean(acc.isFrozen),
      sendsThisMonth: acc.sendsThisMonth ?? 0,
      expiresAt: acc.expiresAt ? new Date(acc.expiresAt).toISOString() : null,
      activeWebhooksCount: (acc.webhooks ?? []).filter((w) => w.active).length,
    })),
  });
};

export const handleLookupMailbox = async (req: Request): Promise<Response> => {
  const body = await parseBody(req);
  if (!await verifySupportBotSignature(body)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = extractParams(body);
  const rawAddress = params.address as string | undefined;
  if (!rawAddress) {
    return Response.json({ error: "Address parameter required" }, {
      status: 400,
    });
  }

  const address = normalizeAddress(rawAddress);
  const { accounts } = await db.query({
    accounts: {
      $: { where: { address } },
      organization: {
        billingUser: {},
      },
      webhooks: {},
    },
  });

  const account = accounts[0];
  if (!account) {
    return Response.json({
      found: false,
      message: `Mailbox ${address} not found`,
    });
  }

  const orgRaw = account.organization;
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;

  return Response.json({
    found: true,
    address: account.address,
    displayName: account.displayName ?? "",
    isFrozen: Boolean(account.isFrozen),
    sendsThisMonth: account.sendsThisMonth ?? 0,
    expiresAt: account.expiresAt
      ? new Date(account.expiresAt).toISOString()
      : null,
    createdAt: account.createdAt
      ? new Date(account.createdAt).toISOString()
      : null,
    organization: org
      ? {
        id: org.id,
        name: org.name,
        balanceDollars: org.balance ?? 0,
        trialUsed: Boolean(org.trialUsed),
      }
      : null,
    webhooks: (account.webhooks ?? []).map((w) => ({
      id: w.id,
      host: redactWebhookHost(w.url),
      active: w.active,
    })),
  });
};
