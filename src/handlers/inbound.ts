import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import { unique } from "gamla";
import { db, id } from "../db.ts";
import { getUtcDayStart, isPayingOrg, planDetails } from "../planData.ts";
import {
  bytesToHex,
  markWebhookEventSeen,
  sanitizeAttachmentFilename,
  timingSafeEqualStrings,
} from "../security.ts";
import { scanInboundEmail } from "../services/jev.ts";
import { captureEvent } from "../services/posthog.ts";
import { notifyQuotaExceeded } from "../services/quotaNotifier.ts";
import { emailDomain } from "../services/resend.ts";
import { uploadFile } from "../services/storage.ts";
import { deliverWithRetry } from "../services/webhookDelivery.ts";
import type { InboundAttachment, InboundEmail } from "../types.ts";

const svixToleranceSeconds = 300;
const replayTtlMs = 10 * 60 * 1000;
const maxRecipientsPerEvent = 10;
const maxAttachmentsCount = 10;
const maxTotalAttachmentBytes = 15 * 1024 * 1024;

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
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  const tsSeconds = Number(svixTimestamp);
  if (
    !Number.isFinite(tsSeconds) ||
    Math.abs(Math.floor(Date.now() / 1000) - tsSeconds) > svixToleranceSeconds
  ) {
    return false;
  }

  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const payloadToSign = `${svixId}.${svixTimestamp}.${body}`;

  const decodedKey = (() => {
    try {
      return new Uint8Array(decodeBase64(rawSecret));
    } catch {
      return null;
    }
  })();

  const keysToTry: readonly BufferSource[] = [
    ...(decodedKey ? [decodedKey] : []),
    new TextEncoder().encode(rawSecret),
    new TextEncoder().encode(secret),
  ];

  const providedSigs = svixSignature.split(" ").filter(Boolean);
  const results = await Promise.all(
    keysToTry.map(async (secretBytes) => {
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
      const matches = await Promise.all(
        providedSigs.map((candidate) =>
          timingSafeEqualStrings(candidate, expectedSig)
        ),
      );
      return matches.some(Boolean);
    }),
  );

  if (!results.some(Boolean)) return false;
  return markWebhookEventSeen(`svix:${svixId}`, replayTtlMs);
};

const verifyForwardEmailSignature = async (
  req: Request,
  body: string,
  secret: string,
): Promise<boolean> => {
  const signature = req.headers.get("x-webhook-signature");
  if (!signature || !secret) return false;
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
  const expectedHex = bytesToHex(new Uint8Array(expected));
  return timingSafeEqualStrings(signature.toLowerCase(), expectedHex);
};

export const verifyInboundSignature = async (
  req: Request,
  body: string,
): Promise<boolean> => {
  const secret = Deno.env.get("INBOUND_WEBHOOK_SECRET") ?? "";
  if (!secret) {
    console.error("[inbound] INBOUND_WEBHOOK_SECRET is not configured");
    return false;
  }
  if (req.headers.has("svix-signature")) {
    const valid = await verifySvixSignature(req, body, secret);
    if (!valid) console.warn("[inbound] Svix signature mismatch or replay");
    return valid;
  }
  if (req.headers.has("x-webhook-signature")) {
    return verifyForwardEmailSignature(req, body, secret);
  }
  return false;
};

// deno-lint-ignore no-explicit-any
const extractAddresses = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field) && typeof field[0] === "string") {
    return field;
  }
  if (Array.isArray(field)) {
    // deno-lint-ignore no-explicit-any
    return field.map((v: any) => v.address ?? String(v)).filter(Boolean);
  }
  if (field.value && Array.isArray(field.value)) {
    // deno-lint-ignore no-explicit-any
    return field.value.map((v: any) => v.address).filter(Boolean);
  }
  if (typeof field === "string") return [field];
  return [];
};

// deno-lint-ignore no-explicit-any
const extractFromString = (field: any): string => {
  if (typeof field === "string") return field;
  if (field?.text) return field.text;
  if (field?.value?.[0]?.address) return field.value[0].address;
  return String(field ?? "");
};

// deno-lint-ignore no-explicit-any
const normalizeAttachments = (rawAtts: any[]): InboundAttachment[] =>
  rawAtts.slice(0, maxAttachmentsCount).map((att) => {
    const safeName = sanitizeAttachmentFilename(
      String(att.filename ?? att.name ?? "attachment"),
    );
    if (typeof att.content === "string") {
      return {
        filename: safeName,
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
      filename: safeName,
      contentType: att.contentType ?? att.content_type ??
        "application/octet-stream",
      size: att.size ?? bytes.length,
      content: encodeBase64(bytes),
    };
  });

const fetchResendEmailData = async (apiKey: string, emailId: string) => {
  const encodedId = encodeURIComponent(emailId);
  const receivingRes = await fetch(
    `https://api.resend.com/emails/receiving/${encodedId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (receivingRes.ok) return receivingRes.json();
  const inboundRes = await fetch(
    `https://api.resend.com/emails/inbound/${encodedId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  return inboundRes.ok ? inboundRes.json() : null;
};

const fetchAttachmentContent = async (att: { download_url?: string }) => {
  if (!att.download_url) return att;
  const dl = await fetch(att.download_url, { redirect: "follow" });
  const buf = new Uint8Array(await dl.arrayBuffer());
  if (buf.byteLength > maxTotalAttachmentBytes) {
    throw new Error("Inbound attachment exceeds maximum allowed size");
  }
  return { ...att, content: encodeBase64(buf) };
};

const fetchResendAttachments = async (apiKey: string, emailId: string) => {
  const encodedId = encodeURIComponent(emailId);
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodedId}/attachments`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return [];
  const list = await res.json();
  return Promise.all(
    (list.data ?? []).slice(0, maxAttachmentsCount).map(fetchAttachmentContent),
  );
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

const extractHeaders = (
  // deno-lint-ignore no-explicit-any
  rawHeaders: any,
): Record<string, string> | undefined =>
  typeof rawHeaders === "object" &&
    rawHeaders !== null &&
    !Array.isArray(rawHeaders)
    ? rawHeaders
    : undefined;

const getHeader = (
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined => {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  return Object.entries(headers).find(
    ([k, v]) => k.toLowerCase() === lower && typeof v === "string" && v !== "",
  )?.[1];
};

// deno-lint-ignore no-explicit-any
const parseReferences = (rawRefs: any): string | undefined => {
  if (Array.isArray(rawRefs)) return rawRefs.join(" ");
  if (typeof rawRefs !== "string" || !rawRefs.trim()) return undefined;
  const trimmed = rawRefs.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.join(" ");
    } catch {
      // ignore JSON parse error
    }
  }
  return trimmed;
};

// deno-lint-ignore no-explicit-any
const normalizePayload = async (raw: any): Promise<InboundEmail> => {
  const data = await resolveResendPayload(raw);
  const from = extractFromString(data.from);
  const to = extractAddresses(data.to);
  const finalTo = to.length > 0 ? to : (data.recipients ?? []);
  const headers = extractHeaders(data.headers);
  const cc = extractAddresses(data.cc);
  const finalCc = cc.length > 0
    ? cc
    : extractAddresses(getHeader(headers, "cc"));
  const references = parseReferences(
    data.references ?? getHeader(headers, "references"),
  );

  return {
    from,
    to: finalTo,
    cc: finalCc.length > 0 ? finalCc : undefined,
    subject: getHeader(headers, "subject") ?? data.subject ?? "",
    text: data.text,
    html: data.html,
    headers,
    messageId: data.messageId ??
      data.message_id ??
      getHeader(headers, "message-id") ??
      data.email_id ??
      data.id,
    inReplyTo: data.inReplyTo ??
      data.in_reply_to ??
      getHeader(headers, "in-reply-to"),
    references,
    attachments: data.attachments?.length
      ? normalizeAttachments(data.attachments)
      : undefined,
  };
};

const countMessages = async (
  accountId: string,
  direction: "inbound" | "outbound",
  since: number,
): Promise<number> => {
  const result = await db.query({
    messages: {
      $: {
        where: {
          "account.id": accountId,
          direction,
          timestamp: { $gte: since },
        },
      },
    },
  });
  return result.messages?.length ?? 0;
};

export const handleInbound = async (
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
    const raw: any = (() => {
      try {
        return JSON.parse(body);
      } catch {
        return undefined;
      }
    })();
    if (raw === undefined) {
      return Response.json(
        { error: "JSON parse failed", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

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

    const scanResult = await scanInboundEmail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: typeof email.text === "string" ? email.text : "",
      html: typeof email.html === "string" ? email.html : "",
    });
    const isSpam = !scanResult.allowed;

    const envelopeRecipients = extractAddresses(
      payload?.received_for ?? payload?.data?.received_for,
    );
    const candidateRecipients = envelopeRecipients.length > 0
      ? envelopeRecipients
      : [...email.to, ...(email.cc ?? [])];

    const domainSuffix = `@${emailDomain.toLowerCase()}`;
    const recipients = unique(candidateRecipients.map(extractAddress))
      .filter((addr) => addr.endsWith(domainSuffix))
      .slice(0, maxRecipientsPerEvent);

    let matched = 0;
    for (const address of recipients) {
      // deno-lint-ignore no-explicit-any
      let accounts: any[];
      try {
        const result = await db.query({
          accounts: {
            $: { where: { address } },
            webhooks: {},
            organization: {
              billingUser: {},
              members: {},
            },
          },
        });
        accounts = result.accounts;
      } catch (e) {
        console.error("[inbound] DB query failed for address:", address, e);
        continue;
      }

      const account = accounts[0];
      if (!account) continue;

      const orgRaw = account.organization;
      const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
      if (!org) continue;

      const orgId = org.id;
      const isAdmin = Boolean(org?.admin);

      const now = Date.now();
      const isExpired = Boolean(account.expiresAt && account.expiresAt < now);
      if (!isAdmin && (account.isFrozen || isExpired)) {
        continue;
      }

      if (!isAdmin) {
        const isPaying = isPayingOrg(org);
        const limits = isPaying
          ? planDetails.limits.paid
          : planDetails.limits.trial;
        const billingEmail = org?.billingUser?.email ||
          org?.members?.find((m: { email?: string }) => Boolean(m.email))
            ?.email;

        const todayUtc = getUtcDayStart();
        const receivesToday = await countMessages(
          account.id,
          "inbound",
          todayUtc,
        );
        if (receivesToday >= limits.receivesPerDay) {
          notifyQuotaExceeded({
            orgId,
            accountAddress: address,
            accountId: account.id,
            quotaType: "daily_receive",
            limit: limits.receivesPerDay,
            billingEmail,
            isPaying,
          }).catch((err) =>
            console.error("[inbound] Quota notify error:", err)
          );
          continue;
        }

        const periodLengthMs = 30 * 24 * 60 * 60 * 1000;
        const periodStart = now - periodLengthMs;
        const receivesThisMonth = await countMessages(
          account.id,
          "inbound",
          periodStart,
        );
        if (receivesThisMonth >= limits.receivesPerMonth) {
          notifyQuotaExceeded({
            orgId,
            accountAddress: address,
            accountId: account.id,
            quotaType: "monthly_receive",
            limit: limits.receivesPerMonth,
            billingEmail,
            isPaying,
          }).catch((err) =>
            console.error("[inbound] Quota notify error:", err)
          );
          continue;
        }
      }

      matched++;

      const attachmentRecords: {
        id: string;
        filename: string;
        contentType: string;
        size: number;
        storageKey: string;
      }[] = [];

      if (email.attachments) {
        let totalBytes = 0;
        for (const att of email.attachments.slice(0, maxAttachmentsCount)) {
          const safeFilename = sanitizeAttachmentFilename(att.filename);
          const data = decodeBase64(att.content);
          totalBytes += data.byteLength;
          if (totalBytes > maxTotalAttachmentBytes) {
            return Response.json(
              { error: "Attachments exceed size limit", code: "BAD_REQUEST" },
              { status: 413 },
            );
          }
          const attId = id();
          const storageKey = `${orgId}/${account.id}/${attId}/${safeFilename}`;
          await uploadFile(storageKey, data, att.contentType);
          attachmentRecords.push({
            id: attId,
            filename: safeFilename,
            contentType: att.contentType,
            size: data.byteLength,
            storageKey,
          });
        }
      }

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
          status: isSpam ? "spam" : "received",
          headers: email.headers ?? {},
          timestamp: Date.now(),
          externalId: email.messageId ?? "",
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
        isSpam,
      });

      if (isSpam) continue;

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
                account_address: account.address,
                from: email.from,
                to: email.to,
                ...(email.cc?.length ? { cc: email.cc } : {}),
                subject: email.subject,
                text: typeof email.text === "string" ? email.text : "",
                html: typeof email.html === "string" ? email.html : "",
                messageId: email.messageId ?? "",
                inReplyTo: email.inReplyTo ?? "",
                references: email.references ?? "",
                headers: email.headers ?? {},
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

    return Response.json({ received: true, matched });
  } catch (err) {
    console.error("[inbound] Unhandled error in handleInbound:", err);
    return Response.json(
      { error: "Internal inbound processing error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
};
