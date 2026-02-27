import { captureEvent } from "./posthog.ts";

const sign = async (secret: string, payload: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

type WebhookPayload = {
  readonly event: string;
  readonly data: unknown;
  readonly timestamp: number;
};

const deliverWebhook = async (
  url: string,
  secret: string,
  payload: WebhookPayload,
  orgId: string,
): Promise<boolean> => {
  const body = JSON.stringify(payload);
  const signature = await sign(secret, body);
  const timestamp = Date.now().toString();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentMail-Signature": signature,
        "X-AgentMail-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    const success = res.ok;
    captureEvent(orgId, "webhook_delivered", {
      url,
      success,
      statusCode: res.status,
      event: payload.event,
    });
    return success;
  } catch (err) {
    captureEvent(orgId, "webhook_delivery_failed", {
      url,
      error: err instanceof Error ? err.message : "Unknown error",
      event: payload.event,
    });
    return false;
  }
};

// Retry with exponential backoff: 1s, 2s, 4s
const deliverWithRetry = async (
  url: string,
  secret: string,
  payload: WebhookPayload,
  orgId: string,
  maxRetries = 3,
): Promise<boolean> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    const success = await deliverWebhook(url, secret, payload, orgId);
    if (success) return true;
  }
  return false;
};

export { deliverWebhook, deliverWithRetry, sign };
export type { WebhookPayload };
