const encoder = new TextEncoder();

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

const isBlockedIpv6Literal = (rawHost: string): boolean => {
  const stripped = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1).toLowerCase()
    : rawHost.toLowerCase();
  if (!stripped.includes(":")) return false;
  return stripped === "::" ||
    stripped === "::1" ||
    stripped.includes("%") ||
    stripped.startsWith("fe8") ||
    stripped.startsWith("fe9") ||
    stripped.startsWith("fea") ||
    stripped.startsWith("feb") ||
    stripped.startsWith("fc") ||
    stripped.startsWith("fd") ||
    stripped.startsWith("ff") ||
    stripped.startsWith("2001:db8") ||
    stripped.startsWith("2001:0:") ||
    stripped.startsWith("2001:0000:") ||
    stripped.startsWith("2002:") ||
    stripped.startsWith("64:ff9b:") ||
    stripped.includes("::ffff:");
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

export const withKeyedLock = <T>(
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

type RateBucket = { readonly timestamps: readonly number[] };
const rateBuckets = new Map<string, RateBucket>();

export const checkSlidingWindowLimit = ({
  key,
  maxRequests,
  windowMs,
}: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): boolean => {
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

export const markWebhookEventSeen = (
  eventKey: string,
  ttlMs: number,
): boolean => {
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
