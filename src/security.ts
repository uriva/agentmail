import type { SecurityGuardNamespace } from "./securityDO.ts";

const encoder = new TextEncoder();

const securityGuardCell: Array<SecurityGuardNamespace | null> = [null];

export const setSecurityGuardNamespace = (
  ns: SecurityGuardNamespace | null | undefined,
): void => {
  securityGuardCell[0] = ns ?? null;
};

const getSecurityGuardStub = (shardKey: string) => {
  const ns = securityGuardCell[0];
  if (!ns) return null;
  return ns.get(ns.idFromName(shardKey));
};

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const sha256Bytes = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

export const timingSafeEqualStrings = async (
  a: string,
  b: string,
): Promise<boolean> => {
  const [ha, hb] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  const diff = ha.reduce(
    (acc, byte, idx) => acc | (byte ^ (hb[idx] ?? 0)),
    ha.length ^ hb.length,
  );
  return diff === 0;
};

export const hmacSha256Hex = async (
  secret: string,
  payload: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(sig));
};

const parseIpv4 = (host: string): readonly number[] | null => {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  if (!parts.every((p) => /^(?:0|[1-9]\d{0,2})$/.test(p))) return null;
  const nums = parts.map(Number);
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
};

const isPrivateIpv4 = (octets: readonly number[]): boolean => {
  const [a, b, c] = octets;
  return a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
};

const parseIpv6Hextets = (rawHost: string): readonly number[] | null => {
  const stripped = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1).toLowerCase()
    : rawHost.toLowerCase();
  if (!stripped.includes(":")) return null;
  if (stripped.includes("%")) return [0xfe80, 0, 0, 0, 0, 0, 0, 0];

  const zoneLess = stripped;
  const doubleColonParts = zoneLess.split("::");
  if (doubleColonParts.length > 2) return null;

  const parseSegmentList = (seg: string): number[] | null => {
    if (!seg) return [];
    const parts = seg.split(":");
    const out: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (i === parts.length - 1 && part.includes(".")) {
        const v4 = parseIpv4(part);
        if (!v4) return null;
        out.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        out.push(parseInt(part, 16));
      }
    }
    return out;
  };

  if (doubleColonParts.length === 1) {
    const groups = parseSegmentList(doubleColonParts[0]!);
    return groups && groups.length === 8 ? groups : null;
  }

  const left = parseSegmentList(doubleColonParts[0]!);
  const right = parseSegmentList(doubleColonParts[1]!);
  if (!left || !right) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;
  return [...left, ...Array(missing).fill(0), ...right];
};

const isBlockedIpv6Literal = (rawHost: string): boolean => {
  const stripped = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1).toLowerCase()
    : rawHost.toLowerCase();
  if (!stripped.includes(":")) return false;
  if (stripped.includes("%")) return true;
  const h = parseIpv6Hextets(stripped);
  if (!h) return true;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = h as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const isAllZeroPrefix6 = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 &&
    h4 === 0 && h5 === 0;
  const isV4Mapped = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 &&
    h4 === 0 && h5 === 0xffff;
  const isNat64 = h0 === 0x0064 && h1 === 0xff9b && h2 === 0 && h3 === 0 &&
    h4 === 0 && h5 === 0;
  const isNat64Local = h0 === 0x0064 && h1 === 0xff9b && h2 === 0x0001;

  if (isAllZeroPrefix6) return true; // ::/96 (unspecified, loopback ::1, IPv4-compatible)
  if (isV4Mapped || isNat64 || isNat64Local) return true;
  if ((h0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((h0 & 0xffc0) === 0xfec0) return true; // deprecated site-local fec0::/10
  if ((h0 & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((h0 & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return true; // discard 100::/64
  if (h0 === 0x2001 && h1 === 0x0db8) return true; // documentation 2001:db8::/32
  if (h0 === 0x2001 && (h1 & 0xfe00) === 0) return true; // IETF protocol / Teredo / benchmarking 2001::/23
  if (h0 === 0x2002) return true; // 6to4 2002::/16
  if (
    h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 &&
    h6 === 0 && h7 <= 1
  ) {
    return true;
  }
  return false;
};

export const isPrivateOrReservedIp = (ip: string): boolean => {
  const v4 = parseIpv4(ip.trim());
  if (v4) return isPrivateIpv4(v4);
  return isBlockedIpv6Literal(ip.trim());
};

const dohEndpoints = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const;

const queryDohRecord = async (
  host: string,
  recordType: "A" | "AAAA",
): Promise<{ ok: boolean; ips: readonly string[] }> => {
  const expectedType = recordType === "A" ? 1 : 28;
  for (const endpoint of dohEndpoints) {
    try {
      const res = await fetch(
        `${endpoint}?name=${encodeURIComponent(host)}&type=${recordType}`,
        {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as {
        Status?: number;
        Answer?: Array<{ type?: number; data?: unknown }>;
      };
      if (json.Status !== 0 && json.Status !== 3) continue;
      const ips = (json.Answer ?? [])
        .filter((a) => a.type === expectedType && typeof a.data === "string")
        .map((a) => String(a.data));
      return { ok: true, ips };
    } catch {
      continue;
    }
  }
  return { ok: false, ips: [] };
};

export const isPublicWebhookHost = async (host: string): Promise<boolean> => {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "").replace(
    /\.+$/,
    "",
  );
  if (!normalized) return false;
  if (parseIpv4(normalized) || normalized.includes(":")) {
    return !isPrivateOrReservedIp(normalized);
  }
  const [aRes, aaaaRes] = await Promise.all([
    queryDohRecord(normalized, "A"),
    queryDohRecord(normalized, "AAAA"),
  ]);
  if (!aRes.ok || !aaaaRes.ok) return false;
  const allIps = [...aRes.ips, ...aaaaRes.ips];
  if (allIps.length === 0) return false;
  return !allIps.some(isPrivateOrReservedIp);
};

export const validateWebhookTargetUrl = (rawUrl: string): string | null => {
  if (
    typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2048
  ) {
    return null;
  }
  const parsed = (() => {
    try {
      return new URL(rawUrl.trim());
    } catch {
      return null;
    }
  })();
  if (!parsed || parsed.username || parsed.password) return null;

  const isTest = Deno.env.get("DENO_ENV") === "test";
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");

  if (
    isTest &&
    parsed.protocol === "http:" &&
    (host === "localhost" || host === "127.0.0.1")
  ) {
    return parsed.toString();
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.port && parsed.port !== "443") return null;
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata" ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host === "theagentmail.net" ||
    host.endsWith(".theagentmail.net") ||
    /^(?:0x[0-9a-f]+|\d+)$/i.test(host)
  ) {
    return null;
  }

  const v4 = parseIpv4(host);
  if (v4 && isPrivateIpv4(v4)) return null;
  if (isBlockedIpv6Literal(host)) return null;

  return parsed.toString();
};

export const sanitizeAttachmentFilename = (raw: string): string => {
  const base = raw.split(/[\\/]/).pop() ?? "attachment";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "_")
    .slice(0, 128);
  return cleaned || "attachment";
};

export const normalizeE164Phone = (raw: string): string | null => {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!/^[1-9]\d{6,14}$/.test(digitsOnly)) return null;
  return `+${digitsOnly}`;
};

const allowedSignupDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "ymail.com",
  "protonmail.com",
  "proton.me",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "pm.me",
  "tutanota.com",
  "tuta.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "qq.com",
  "163.com",
  "126.com",
]);

export const isAllowedSignupEmail = (email: string): boolean => {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (
    !domain || domain === "theagentmail.net" ||
    domain.endsWith(".theagentmail.net")
  ) {
    return false;
  }
  if (Deno.env.get("DENO_ENV") === "test" && domain === "example.com") {
    return true;
  }
  return allowedSignupDomains.has(domain);
};

const lockQueues = new Map<string, Promise<unknown>>();
const distributedLockTtlMs = 30_000;
const distributedLockMaxWaitMs = 20_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const withLocalKeyedLock = <T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const previous = lockQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(fn);
  const cleanup = current.finally(() => {
    if (lockQueues.get(key) === cleanup) {
      lockQueues.delete(key);
    }
  });
  lockQueues.set(key, cleanup);
  return current;
};

export const withKeyedLock = async <T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const stub = getSecurityGuardStub(`lock:${key}`);
  if (!stub) {
    return withLocalKeyedLock(key, fn);
  }
  const owner = crypto.randomUUID();
  const deadline = Date.now() + distributedLockMaxWaitMs;
  let acquired = false;
  while (Date.now() < deadline) {
    const res = await stub.fetch("https://do/lock/acquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, owner, ttlMs: distributedLockTtlMs }),
    });
    const data = (await res.json()) as { acquired?: boolean };
    if (data.acquired) {
      acquired = true;
      break;
    }
    await sleep(40 + Math.floor(Math.random() * 60));
  }
  if (!acquired) {
    throw {
      status: 503,
      error: "Resource busy, please retry shortly",
      code: "RESOURCE_BUSY",
    };
  }
  try {
    return await fn();
  } finally {
    await stub
      .fetch("https://do/lock/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, owner }),
      })
      .catch(() => {});
  }
};

type RateBucket = { readonly timestamps: readonly number[] };
const rateBuckets = new Map<string, RateBucket>();

export const checkSlidingWindowLimit = async ({
  key,
  maxRequests,
  windowMs,
}: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): Promise<boolean> => {
  const stub = getSecurityGuardStub(`rate:${key}`);
  if (stub) {
    const res = await stub.fetch("https://do/rate/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, maxRequests, windowMs }),
    });
    const data = (await res.json()) as { allowed?: boolean };
    return Boolean(data.allowed);
  }
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = (rateBuckets.get(key)?.timestamps ?? []).filter(
    (t) => t > cutoff,
  );
  if (existing.length >= maxRequests) {
    rateBuckets.set(key, { timestamps: existing });
    return false;
  }
  if (rateBuckets.size > 5_000) {
    const oldestKey = rateBuckets.keys().next().value;
    if (oldestKey) rateBuckets.delete(oldestKey);
  }
  rateBuckets.set(key, { timestamps: [...existing, now] });
  return true;
};

const replayIds = new Map<string, number>();

export const markWebhookEventSeen = async (
  eventKey: string,
  ttlMs: number,
): Promise<boolean> => {
  const stub = getSecurityGuardStub(`replay:${eventKey}`);
  if (stub) {
    const res = await stub.fetch("https://do/replay/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventKey, ttlMs }),
    });
    const data = (await res.json()) as { fresh?: boolean };
    return Boolean(data.fresh);
  }
  const now = Date.now();
  const existingExpiry = replayIds.get(eventKey);
  if (existingExpiry !== undefined && existingExpiry > now) {
    return false;
  }
  if (replayIds.size > 5_000) {
    const oldestKey = replayIds.keys().next().value;
    if (oldestKey) replayIds.delete(oldestKey);
  }
  replayIds.set(eventKey, now + ttlMs);
  return true;
};
