import { db, id } from "../db.ts";
import type { InboundEmail } from "../types.ts";
import { recordKarmaEvent } from "../services/karma.ts";
import { uploadFile } from "../services/storage.ts";
import { deliverWithRetry } from "../services/webhookDelivery.ts";
import { captureEvent } from "../services/posthog.ts";

const INBOUND_WEBHOOK_SECRET = Deno.env.get("INBOUND_WEBHOOK_SECRET") ?? "";

// Only award karma for emails from domains that are hard to create
// throwaway accounts on. Prevents self-sending karma farming.
const TRUSTED_SENDER_DOMAINS = new Set([
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

const extractAddress = (raw: string): string => {
  const addr = raw.includes("<")
    ? raw.match(/<(.+)>/)?.[1] ?? raw
    : raw;
  return addr.toLowerCase().trim();
};

const extractDomain = (from: string): string =>
  extractAddress(from).split("@")[1] ?? "";

const isFromTrustedDomain = (from: string): boolean =>
  TRUSTED_SENDER_DOMAINS.has(extractDomain(from));

// Check if the agent has an unanswered inbound from this sender.
// If so, no karma — you only earn karma once per inbound until you reply.
const hasUnansweredInbound = (
  messages: { from: string; to: unknown; direction: string; timestamp: number }[],
  senderAddress: string,
): boolean => {
  const relevant = messages
    .filter((m) => {
      if (m.direction === "inbound") {
        return extractAddress(m.from) === senderAddress;
      }
      if (m.direction === "outbound") {
        const toList = m.to as string[];
        return toList.some((t) => extractAddress(t) === senderAddress);
      }
      return false;
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  // If the most recent exchange with this sender is an inbound,
  // the agent hasn't replied yet — no karma.
  return relevant.length > 0 && relevant[0]!.direction === "inbound";
};

const verifyInboundSignature = async (
  req: Request,
  body: string,
): Promise<boolean> => {
  if (!INBOUND_WEBHOOK_SECRET) return true; // Skip in dev
  const signature = req.headers.get("x-webhook-signature") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(INBOUND_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expectedHex;
};

const handleInbound = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  const body = await req.text();

  const valid = await verifyInboundSignature(req, body);
  if (!valid) {
    return Response.json(
      { error: "Invalid signature", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const email = JSON.parse(body) as InboundEmail;

  // Find target account(s) by recipient address
  const recipients = [...email.to, ...(email.cc ?? [])];
  for (const recipient of recipients) {
    const address = recipient.includes("<")
      ? recipient.match(/<(.+)>/)?.[1] ?? recipient
      : recipient;

    const { accounts } = await db.query({
      accounts: {
        $: { where: { address: address.toLowerCase() } },
        webhooks: {},
        organization: {},
        messages: {},
      },
    });

    const account = accounts[0];
    if (!account) continue;

    const org = account.organization;
    if (!org) continue;
    const orgId = org.id;

    // Store attachments in GCS
    const attachmentRecords: {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      storageKey: string;
    }[] = [];

    if (email.attachments) {
      for (const att of email.attachments) {
        const attId = id();
        const storageKey = `${orgId}/${account.id}/${attId}/${att.filename}`;
        const data = Uint8Array.from(atob(att.content), (c) =>
          c.charCodeAt(0),
        );
        await uploadFile(storageKey, data, att.contentType);
        attachmentRecords.push({
          id: attId,
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          storageKey,
        });
      }
    }

    // Store message in DB
    const messageId = id();
    // deno-lint-ignore no-explicit-any
    const txOps: any[] = [
      db.tx.messages[messageId]!.update({
        from: email.from,
        to: [...email.to],
        cc: email.cc ? [...email.cc] : undefined,
        subject: email.subject,
        bodyText: email.text ?? "",
        bodyHtml: email.html ?? "",
        direction: "inbound",
        status: "received",
        headers: email.headers ?? {},
        timestamp: Date.now(),
        inReplyTo: email.inReplyTo ?? "",
        references: email.references ?? "",
      }),
      db.tx.messages[messageId]!.link({ account: account.id }),
    ];

    for (const att of attachmentRecords) {
      txOps.push(
        db.tx.attachments[att.id]!.update({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          storageKey: att.storageKey,
          createdAt: Date.now(),
        }),
        db.tx.attachments[att.id]!.link({ message: messageId }),
      );
    }

    await db.transact(txOps);

    // Record karma only if:
    // 1. Sender is from a trusted domain (prevents self-send farming)
    // 2. No unanswered inbound from this sender (one karma per turn)
    const senderAddr = extractAddress(email.from);
    const trusted = isFromTrustedDomain(email.from);
    const unanswered = hasUnansweredInbound(
      account.messages as { from: string; to: unknown; direction: string; timestamp: number }[],
      senderAddr,
    );
    if (trusted && !unanswered) {
      await recordKarmaEvent(orgId, "email_received", {
        messageId,
        from: email.from,
      });
    }

    captureEvent(orgId, "email_received", {
      from: email.from,
      to: address,
      hasAttachments: attachmentRecords.length > 0,
    });

    // Deliver to agent webhooks (fire and forget)
    const activeWebhooks = account.webhooks.filter((w) => w.active);
    for (const webhook of activeWebhooks) {
      deliverWithRetry(
        webhook.url,
        webhook.secret,
        {
          event: "email.received",
          data: {
            id: messageId,
            from: email.from,
            to: email.to,
            subject: email.subject,
            text: email.text,
            html: email.html,
            attachments: attachmentRecords.map((a) => ({
              id: a.id,
              filename: a.filename,
              contentType: a.contentType,
              size: a.size,
            })),
          },
          timestamp: Date.now(),
        },
        orgId,
      );
    }
  }

  return Response.json({ received: true });
};

export { handleInbound };
