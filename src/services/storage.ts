const GCP_PROJECT_ID = Deno.env.get("GCP_PROJECT") ?? "";
const GCP_STORAGE_BUCKET =
  Deno.env.get("GCP_STORAGE_BUCKET") ?? "agentmail-attachments";
const GCP_SERVICE_ACCOUNT_KEY = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY") ?? "";

type ServiceAccountKey = {
  readonly client_email: string;
  readonly private_key: string;
};

const getServiceAccount = (): ServiceAccountKey =>
  GCP_SERVICE_ACCOUNT_KEY
    ? JSON.parse(GCP_SERVICE_ACCOUNT_KEY)
    : { client_email: "", private_key: "" };

// Create a signed JWT for GCP authentication
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

let cachedToken: { token: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const jwt = await createGcpJwt();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
};

// Upload a file to GCS
const uploadFile = async (
  storageKey: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> => {
  const token = await getAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${GCP_STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(storageKey)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: data,
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

// Generate a signed URL for reading
const getSignedUrl = async (
  storageKey: string,
  expiresInSeconds = 3600,
): Promise<string> => {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const expires = now + expiresInSeconds;
  const host = "storage.googleapis.com";
  const encodedStorageKey = storageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const path = `/${GCP_STORAGE_BUCKET}/${encodedStorageKey}`;
  const canonicalRequest = [
    "GET",
    path,
    `X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=${encodeURIComponent(`${sa.client_email}/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}/auto/storage/goog4_request`)}&X-Goog-Date=${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z&X-Goog-Expires=${expiresInSeconds}&X-Goog-SignedHeaders=host`,
    `host:${host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const datestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const datetime = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";

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

  return `https://${host}${path}?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=${encodeURIComponent(`${sa.client_email}/${credentialScope}`)}&X-Goog-Date=${datetime}&X-Goog-Expires=${expiresInSeconds}&X-Goog-SignedHeaders=host&X-Goog-Signature=${sig}`;
};

// Delete a file from GCS
const deleteFile = async (storageKey: string): Promise<void> => {
  const token = await getAccessToken();
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${GCP_STORAGE_BUCKET}/o/${encodeURIComponent(storageKey)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
};

export { uploadFile, getSignedUrl, deleteFile, GCP_STORAGE_BUCKET };
