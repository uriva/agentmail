import { validateWebhookTargetUrl } from "../security.ts";
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
  const safeUrl = validateWebhookTargetUrl(url);
  if (!safeUrl) {
    console.warn("[webhook] Blocked unsafe webhook URL:", url);
    return false;
  }

  const body = JSON.stringify(payload);
  const timestamp = String(payload.timestamp);
  const [signature, timestampedSignature] = await Promise.all([
    sign(secret, body),
    sign(secret, `${timestamp}.${body}`),
  ]);

  try {
    const res = await fetch(safeUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-AgentMail-Signature": signature,
        "X-AgentMail-Signature-256": `v1=${timestampedSignature}`,
        "X-AgentMail-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    const success = res.ok;
    await res.body?.cancel().catch(() => {});
    captureEvent(orgId, "webhook_delivered", {
      url: safeUrl,
      success,
      statusCode: res.status,
      event: payload.event,
    });
    return success;
  } catch (err) {
    captureEvent(orgId, "webhook_delivery_failed", {
      url: safeUrl,
      error: err instanceof Error ? err.message : "Unknown error",
      event: payload.event,
    });
    return false;
  }
};

const deliverWithRetry = async (
  url: string,
  secret: string,
  payload: WebhookPayload,
  orgId: string,
  maxRetries = 3,
): Promise<boolean> => {
  const safeUrl = validateWebhookTargetUrl(url);
  if (!safeUrl) return false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    const success = await deliverWebhook(safeUrl, secret, payload, orgId);
    if (success) return true;
  }
  return false;
};

export { deliverWebhook, deliverWithRetry, sign };
export type { WebhookPayload };
