import { sanitizeAttachmentFilename } from "../security.ts";

type ServiceAccountKey = {
  readonly client_email: string;
  readonly private_key: string;
};

const getBucketName = (): string =>
  Deno.env.get("GCP_STORAGE_BUCKET") || "agentmail-attachments";

const getServiceAccount = (): ServiceAccountKey => {
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY") ?? "";
  return raw ? JSON.parse(raw) : { client_email: "", private_key: "" };
};

const encodeRfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const dangerousInlineMimePrefixes = [
  "text/html",
  "application/xhtml",
  "image/svg",
  "text/xml",
  "application/xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
];

const safeDownloadContentType = (rawContentType?: string): string | null => {
  if (!rawContentType) return null;
  const lower = rawContentType.trim().toLowerCase();
  return dangerousInlineMimePrefixes.some((p) => lower.startsWith(p))
    ? "application/octet-stream"
    : null;
};

const createGcpJwt = async (): Promise<string> => {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.full_control",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${sig}`;
};

const tokenCache: { token: string; expiresAt: number }[] = [];

const getAccessToken = async (): Promise<string> => {
  const cached = tokenCache[0];
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const jwt = await createGcpJwt();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache[0] = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
};

const uploadFile = async (
  storageKey: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> => {
  const bucket = getBucketName();
  const token = await getAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${
      encodeURIComponent(storageKey)
    }`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": safeDownloadContentType(contentType) ?? contentType,
      },
      body: data as unknown as BodyInit,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw {
      status: 500,
      error: `GCP Storage upload failed: ${body}`,
      code: "STORAGE_ERROR",
    };
  }
};

const getSignedUrl = async (
  storageKey: string,
  expiresInSeconds = 3600,
  filename = "attachment",
  contentType?: string,
): Promise<string> => {
  const bucket = getBucketName();
  const sa = getServiceAccount();
  const host = "storage.googleapis.com";
  const safeSegments = storageKey
    .split("/")
    .filter((seg) => seg.length > 0 && seg !== "." && seg !== "..")
    .map(encodeRfc3986);
  const path = `/${bucket}/${safeSegments.join("/")}`;

  const nowIso = new Date().toISOString();
  const datestamp = nowIso.slice(0, 10).replace(/-/g, "");
  const datetime = `${nowIso.replace(/[-:]/g, "").split(".")[0]}Z`;
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;

  const safeName = sanitizeAttachmentFilename(filename);
  const forcedMime = safeDownloadContentType(contentType);

  const queryEntries: Array<[string, string]> = [
    ["X-Goog-Algorithm", "GOOG4-RSA-SHA256"],
    ["X-Goog-Credential", `${sa.client_email}/${credentialScope}`],
    ["X-Goog-Date", datetime],
    ["X-Goog-Expires", String(expiresInSeconds)],
    ["X-Goog-SignedHeaders", "host"],
    ["response-content-disposition", `attachment; filename="${safeName}"`],
    ...(forcedMime
      ? [["response-content-type", forcedMime] as [string, string]]
      : []),
  ];

  const canonicalQuery = queryEntries
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    path,
    canonicalQuery,
    `host:${host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalRequest),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [
    "GOOG4-RSA-SHA256",
    datetime,
    credentialScope,
    canonicalHash,
  ].join("\n");

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(stringToSign),
  );

  const sig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `https://${host}${path}?${canonicalQuery}&X-Goog-Signature=${sig}`;
};

const deleteFile = async (storageKey: string): Promise<void> => {
  const bucket = getBucketName();
  const token = await getAccessToken();
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${
      encodeURIComponent(storageKey)
    }`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
};

export { deleteFile, getSignedUrl, uploadFile };
