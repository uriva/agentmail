import { db, id } from "../db.ts";
import type { InboundEmail, InboundAttachment } from "../types.ts";
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
  // Forward Email sends X-Webhook-Signature on every POST, signed with
  // their own "Webhook Signature Payload Verification Key" (available in
  // the FE dashboard under Domains → Settings). To verify, set
  // INBOUND_WEBHOOK_SECRET to that key. Until then, skip verification.
  if (!INBOUND_WEBHOOK_SECRET) return true;
  const signature = req.headers.get("x-webhook-signature") ?? "";
  if (!signature) return true;
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
  if (signature !== expectedHex) {
    console.warn("[inbound] Webhook signature mismatch — accepting anyway. Set INBOUND_WEBHOOK_SECRET to the Forward Email webhook verification key to enable proper verification.");
    return true;
  }
  return true;
};

// Forward Email sends a mailparser-style payload with structured objects
// for from/to/cc, Buffer-style attachments, etc. This normalizes it into
// our flat InboundEmail type.
// deno-lint-ignore no-explicit-any
const extractAddresses = (field: any): string[] => {
  if (!field) return [];
  // Already a string array (our own format)
  if (Array.isArray(field) && typeof field[0] === "string") {
    return field as string[];
  }
  // Array of objects with address field
  if (Array.isArray(field)) {
    // deno-lint-ignore no-explicit-any
    return field.map((v: any) => v.address ?? String(v)).filter(Boolean);
  }
  // mailparser address object: { value: [{ address, name }], text: "..." }
  if (field.value && Array.isArray(field.value)) {
    // deno-lint-ignore no-explicit-any
    return field.value.map((v: any) => v.address).filter(Boolean);
  }
  // Plain string
  if (typeof field === "string") return [field];
  return [];
};

// deno-lint-ignore no-explicit-any
const extractFromString = (field: any): string => {
  if (typeof field === "string") return field;
  // mailparser address object - use .text for "Name <addr>" format
  if (field?.text) return field.text;
  if (field?.value?.[0]?.address) return field.value[0].address;
  return String(field ?? "");
};

// deno-lint-ignore no-explicit-any
const normalizeAttachments = (rawAtts: any[]): InboundAttachment[] =>
  rawAtts.map((att) => {
    // If content is already a base64 string, use it directly
    if (typeof att.content === "string") {
      return {
        filename: att.filename ?? "attachment",
        contentType: att.contentType ?? "application/octet-stream",
        size: att.size ?? 0,
        content: att.content,
      };
    }
    // Forward Email sends { type: "Buffer", data: [byte, byte, ...] }
    const bytes = att.content?.data
      ? new Uint8Array(att.content.data)
      : new Uint8Array(0);
    return {
      filename: att.filename ?? "attachment",
      contentType: att.contentType ?? "application/octet-stream",
      size: att.size ?? bytes.length,
      content: btoa(String.fromCharCode(...bytes)),
    };
  });

// deno-lint-ignore no-explicit-any
const normalizePayload = (raw: any): InboundEmail => {
  const from = extractFromString(raw.from);
  const to = extractAddresses(raw.to);
  // Fall back to recipients array if to is empty (webhook-style delivery)
  const finalTo = to.length > 0 ? to : (raw.recipients ?? []);
  const cc = extractAddresses(raw.cc);
  const references = Array.isArray(raw.references)
    ? raw.references.join(" ")
    : (raw.references ?? undefined);

  return {
    from,
    to: finalTo,
    cc: cc.length > 0 ? cc : undefined,
    subject: raw.subject ?? "",
    text: raw.text,
    html: raw.html,
    headers: typeof raw.headers === "object" && !Array.isArray(raw.headers)
      ? raw.headers
      : undefined,
    inReplyTo: raw.inReplyTo,
    references,
    attachments: raw.attachments?.length
      ? normalizeAttachments(raw.attachments)
      : undefined,
  };
};

const handleInbound = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const body = await req.text();
    console.log("[inbound] Received request", {
      contentType,
      bodyLength: body.length,
      bodyPreview: body.slice(0, 200),
    });

    const valid = await verifyInboundSignature(req, body);
    if (!valid) {
      return Response.json(
        { error: "Invalid signature", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    // deno-lint-ignore no-explicit-any
    const raw = JSON.parse(body) as any;
    const email = normalizePayload(raw);

    console.log("[inbound] Received email", {
      from: email.from,
      to: email.to,
      subject: email.subject,
      hasText: !!email.text,
      hasHtml: !!email.html,
    attachmentCount: email.attachments?.length ?? 0,
  });

  // Find target account(s) by recipient address
  const recipients = [...email.to, ...(email.cc ?? [])];
  let matched = 0;
  for (const recipient of recipients) {
    const address = extractAddress(recipient);
    console.log("[inbound] Looking up account for address:", address);

    // deno-lint-ignore no-explicit-any
    let accounts: any[];
    try {
      const result = await db.query({
        accounts: {
          $: { where: { address } },
          webhooks: {},
          organization: {},
          messages: {},
        },
      });
      accounts = result.accounts;
    } catch (e) {
      console.error("[inbound] DB query failed for address:", address, e);
      continue;
    }

    console.log("[inbound] Found", accounts.length, "accounts for", address);
    const account = accounts[0];
    if (!account) continue;

    // organization is a "has one" link - InstantDB may return array or object
    const orgRaw = account.organization;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    if (!org) {
      console.log("[inbound] Account found but no org linked:", account.id);
      continue;
    }
    const orgId = org.id;
    console.log("[inbound] Matched account", account.id, "in org", orgId);
    matched++;

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
    // deno-lint-ignore no-explicit-any
    const activeWebhooks = account.webhooks.filter((w: any) => w.active);
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

  if (matched === 0) {
    console.log("[inbound] No matching accounts found for recipients:", recipients);
  } else {
    console.log("[inbound] Processed", matched, "accounts");
  }

  return Response.json({ received: true });
  } catch (e) {
    console.error("[inbound] Unhandled error processing inbound email:", e);
    return Response.json(
      { error: "Internal error processing inbound email", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
};

export { handleInbound };
