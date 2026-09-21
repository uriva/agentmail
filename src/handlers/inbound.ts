import { db, id } from "../db.ts";
import type { InboundAttachment, InboundEmail } from "../types.ts";
import { uploadFile } from "../services/storage.ts";
import { deliverWithRetry } from "../services/webhookDelivery.ts";
import { captureEvent } from "../services/posthog.ts";
import { sendEmail } from "../services/resend.ts";
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding/base64";
import { coerce } from "gamla";

const INBOUND_WEBHOOK_SECRET = coerce(Deno.env.get("INBOUND_WEBHOOK_SECRET"));

const extractAddress = (raw: string): string => {
  const addr = raw.includes("<") ? raw.match(/<(.+)>/)?.[1] ?? raw : raw;
  return addr.toLowerCase().trim();
};

const verifySvixSignature = async (
  req: Request,
  body: string,
  secret: string,
): Promise<boolean> => {
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const payloadToSign = `${svixId}.${svixTimestamp}.${body}`;

  const keysToTry: BufferSource[] = [];
  try {
    keysToTry.push(new Uint8Array(decodeBase64(rawSecret)));
  } catch {
    // ignore base64 parse error
  }
  keysToTry.push(new TextEncoder().encode(rawSecret));
  keysToTry.push(new TextEncoder().encode(secret));

  for (const secretBytes of keysToTry) {
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payloadToSign),
    );
    const expectedSig = `v1,${encodeBase64(signed)}`;
    if (svixSignature.split(" ").includes(expectedSig)) {
      return true;
    }
  }
  return false;
};

const verifyForwardEmailSignature = async (
  req: Request,
  body: string,
  secret: string,
): Promise<boolean> => {
  const signature = req.headers.get("x-webhook-signature");
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
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

const verifyInboundSignature = async (
  req: Request,
  body: string,
): Promise<boolean> => {
  if (req.headers.has("svix-signature")) {
    const valid = await verifySvixSignature(req, body, INBOUND_WEBHOOK_SECRET);
    if (!valid) console.warn("[inbound] Svix signature mismatch");
    return valid;
  }
  if (req.headers.has("x-webhook-signature")) {
    return await verifyForwardEmailSignature(req, body, INBOUND_WEBHOOK_SECRET);
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
    if (typeof att.content === "string") {
      return {
        filename: att.filename ?? att.name ?? "attachment",
        contentType: att.contentType ?? att.content_type ??
          "application/octet-stream",
        size: att.size ?? 0,
        content: att.content,
      };
    }
    const bytes = att.content?.data
      ? new Uint8Array(att.content.data)
      : new Uint8Array(0);
    return {
      filename: att.filename ?? att.name ?? "attachment",
      contentType: att.contentType ?? att.content_type ??
        "application/octet-stream",
      size: att.size ?? bytes.length,
      content: encodeBase64(bytes),
    };
  });

const supportEmailAddress = "support@theagentmail.net";
const supportForwardDestination = Deno.env.get("SUPPORT_FORWARD_EMAIL") ??
  "uri.valevski@gmail.com";

const isSupportRecipient = (recipient: string) =>
  extractAddress(recipient) === supportEmailAddress;

const stripHtml = (html: string) =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const formatAttachmentSummary = (att: InboundAttachment) =>
  `- ${att.filename} (${att.contentType}, ${att.size} bytes)`;

const formatAttachmentsSection = (attachments?: readonly InboundAttachment[]) =>
  attachments?.length
    ? `\nAttachments:\n${attachments.map(formatAttachmentSummary).join("\n")}\n`
    : "";

const extractSupportBody = ({ text, html }: InboundEmail) =>
  text || (typeof html === "string" ? stripHtml(html) : "(no text content)");

const formatSupportNotification = (email: InboundEmail) =>
  `[Support Notification]
A new message was received for ${supportEmailAddress}.

From: ${email.from}
To: ${email.to.join(", ")}
Subject: ${email.subject || "(no subject)"}${
    formatAttachmentsSection(email.attachments)
  }
--------------------------------------------------
${extractSupportBody(email)}
--------------------------------------------------

Reply directly to this email to respond to ${email.from}.`;

const forwardSupportEmail = (email: InboundEmail) => {
  console.log(
    "[inbound] Forwarding support email to",
    supportForwardDestination,
  );
  return sendEmail({
    from: "AgentMail Support <support@theagentmail.net>",
    to: [supportForwardDestination],
    replyTo: email.from,
    subject: `[Support Request] ${email.subject || "(no subject)"}`,
    text: formatSupportNotification(email),
    inReplyTo: email.inReplyTo,
    references: email.references,
  });
};

const fetchResendEmailData = async (apiKey: string, emailId: string) => {
  const receivingRes = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (receivingRes.ok) return receivingRes.json();
  const inboundRes = await fetch(
    `https://api.resend.com/emails/inbound/${emailId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  return inboundRes.ok ? inboundRes.json() : null;
};

const fetchAttachmentContent = async (att: { download_url?: string }) => {
  if (!att.download_url) return att;
  const dl = await fetch(att.download_url);
  const buf = new Uint8Array(await dl.arrayBuffer());
  return { ...att, content: encodeBase64(buf) };
};

const fetchResendAttachments = async (apiKey: string, emailId: string) => {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return [];
  const list = await res.json();
  return Promise.all((list.data ?? []).map(fetchAttachmentContent));
};

// deno-lint-ignore no-explicit-any
const fetchResendInboundEmail = async (emailId: string): Promise<any> => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendApiKey || !emailId) {
    console.log("[inbound] fetchResendInboundEmail missing key or id", {
      hasKey: !!resendApiKey,
      emailId,
    });
    return null;
  }
  const email = await fetchResendEmailData(resendApiKey, emailId);
  if (!email) {
    console.log("[inbound] fetchResendInboundEmail failed for", emailId);
    return null;
  }
  const attachments = email.attachments?.length
    ? await fetchResendAttachments(resendApiKey, emailId)
    : [];
  return {
    ...email,
    ...(attachments.length ? { attachments } : {}),
  };
};

// deno-lint-ignore no-explicit-any
const resolveResendPayload = async (raw: any): Promise<any> => {
  const baseData = raw?.type === "email.received" && raw.data ? raw.data : raw;
  const emailId = baseData?.email_id ?? baseData?.id;
  if (raw?.type === "email.received" && emailId) {
    const fetched = await fetchResendInboundEmail(emailId);
    return fetched ? { ...baseData, ...fetched } : baseData;
  }
  return baseData;
};

// deno-lint-ignore no-explicit-any
const normalizePayload = async (raw: any): Promise<InboundEmail> => {
  const data = await resolveResendPayload(raw);
  const from = extractFromString(data.from);
  const to = extractAddresses(data.to);
  const finalTo = to.length > 0 ? to : (data.recipients ?? []);
  const cc = extractAddresses(data.cc);
  const references = Array.isArray(data.references)
    ? data.references.join(" ")
    : (data.references ?? undefined);

  return {
    from,
    to: finalTo,
    cc: cc.length > 0 ? cc : undefined,
    subject: data.subject ?? "",
    text: data.text,
    html: data.html,
    headers: typeof data.headers === "object" && !Array.isArray(data.headers)
      ? data.headers
      : undefined,
    messageId: data.messageId ?? data.message_id ?? data.email_id ?? data.id,
    inReplyTo: data.inReplyTo ?? data.in_reply_to,
    references,
    attachments: data.attachments?.length
      ? normalizeAttachments(data.attachments)
      : undefined,
  };
};

const handleInbound = async (
  req: Request,
  _params: Record<string, string>,
  _orgId: string,
): Promise<Response> => {
  try {
    const body = await req.text();

    const valid = await verifyInboundSignature(req, body);
    if (!valid) {
      return Response.json(
        { error: "Invalid signature", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    // deno-lint-ignore no-explicit-any
    let raw: any;
    try {
      raw = JSON.parse(body);
    } catch (parseErr) {
      console.error(
        "[inbound] JSON parse failed:",
        parseErr,
        "body preview:",
        body.slice(0, 500),
      );
      return Response.json(
        { error: `JSON parse failed: ${parseErr}`, code: "BAD_REQUEST" },
        { status: 400 },
      );
    }
    // Forward Email may send an array; use first element if so
    const payload = Array.isArray(raw) ? raw[0] : raw;
    if (!payload || typeof payload !== "object") {
      return Response.json(
        {
          error: `Unexpected payload type: ${typeof payload}`,
          code: "BAD_REQUEST",
        },
        { status: 400 },
      );
    }
    const email = await normalizePayload(payload);

    console.log("[inbound] Received email", {
      from: email.from,
      to: email.to,
      subject: email.subject,
      attachmentCount: email.attachments?.length ?? 0,
    });

    // Find target account(s) by recipient address
    const recipients = [
      ...email.to,
      ...(email.cc ?? []),
      ...extractAddresses(payload?.received_for ?? payload?.data?.received_for),
    ];

    if (recipients.some(isSupportRecipient)) {
      await forwardSupportEmail(email);
    }

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
          const data = decodeBase64(att.content);
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
          bodyText: typeof email.text === "string" ? email.text : "",
          bodyHtml: typeof email.html === "string" ? email.html : "",
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

      captureEvent(orgId, "email_received", {
        from: email.from,
        to: address,
        hasAttachments: attachmentRecords.length > 0,
      });

      // Deliver to agent webhooks — await to prevent isolate eviction before delivery
      // deno-lint-ignore no-explicit-any
      const activeWebhooks = account.webhooks.filter((w: any) => w.active);
      await Promise.all(
        activeWebhooks.map((webhook: { url: string; secret: string }) =>
          deliverWithRetry(
            webhook.url,
            webhook.secret,
            {
              event: "email.received",
              data: {
                id: messageId,
                account_id: account.id,
                from: email.from,
                to: email.to,
                subject: email.subject,
                text: typeof email.text === "string" ? email.text : "",
                html: typeof email.html === "string" ? email.html : "",
                messageId: email.messageId ?? "",
                inReplyTo: email.inReplyTo ?? "",
                references: email.references ?? "",
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
          )
        ),
      );
    }

    if (matched === 0) {
      console.log(
        "[inbound] No matching accounts found for recipients:",
        recipients,
      );
    } else {
      console.log("[inbound] Processed", matched, "accounts");
    }

    return Response.json({ received: true });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error(
      "[inbound] Unhandled error processing inbound email:",
      errorMessage,
      errorStack,
    );
    return Response.json(
      {
        error: `Inbound processing error: ${errorMessage}`,
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
};

export { handleInbound };
