import { decodeBase64 } from "@std/encoding/base64";
import { db, id } from "../db.ts";
import { getUtcDayStart, isPayingOrg, planDetails } from "../planData.ts";
import { sanitizeAttachmentFilename, withKeyedLock } from "../security.ts";
import { scanOutboundEmail } from "../services/jev.ts";
import { captureEvent } from "../services/posthog.ts";
import { notifyQuotaExceeded } from "../services/quotaNotifier.ts";
import { sendEmail } from "../services/resend.ts";
import { uploadFile } from "../services/storage.ts";
import type { ApiResponse, SendEmailInput } from "../types.ts";

const maxRecipientsPerMessage = 10;
const maxAttachmentsPerMessage = 10;
const maxOutboundAttachmentBytes = 10 * 1024 * 1024;

const spamPatterns = [
  "페이지 소유권 확인",
  "Meta 비즈니스 지원",
  "비즈니스 신원 확인",
  "커뮤니티 표준",
  "영구적으로 비활성화",
  "지금 인증하기",
  "clearcare.fr",
  "meta support",
  "facebook support",
  "meta platforms",
  "community support",
  "account verification required",
  "verify your page",
  "security alert",
  "account suspended",
];

const containsSpam = (input: SendEmailInput): boolean => {
  const content = `${input.subject ?? ""} ${input.text ?? ""} ${
    input.html ?? ""
  }`.toLowerCase();
  return spamPatterns.some((pattern) =>
    content.includes(pattern.toLowerCase())
  );
};

const countOutboundRecipientsSince = async (
  accountId: string,
  since: number,
): Promise<number> => {
  const result = await db.query({
    messages: {
      $: {
        where: {
          "account.id": accountId,
          direction: "outbound",
          timestamp: { $gte: since },
        },
      },
    },
  });
  return (result.messages ?? []).reduce((sum, m) => {
    const toCount = Array.isArray(m.to) ? m.to.length : 1;
    const ccCount = Array.isArray(m.cc) ? m.cc.length : 0;
    const bccCount = Array.isArray(m.bcc) ? m.bcc.length : 0;
    return sum + Math.max(1, toCount + ccCount + bccCount);
  }, 0);
};

const sendMessage = async (
  req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId;
  if (!accountId) {
    return Response.json(
      { error: "accountId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const input = (await req.json()) as SendEmailInput;
  if (!Array.isArray(input.to) || input.to.length === 0) {
    return Response.json(
      {
        error: "At least one recipient in 'to' is required",
        code: "BAD_REQUEST",
      },
      { status: 400 },
    );
  }

  const recipientCount = input.to.length +
    (input.cc?.length ?? 0) +
    (input.bcc?.length ?? 0);
  if (recipientCount > maxRecipientsPerMessage) {
    return Response.json(
      {
        error:
          `Too many recipients (maximum ${maxRecipientsPerMessage} per message)`,
        code: "TOO_MANY_RECIPIENTS",
      },
      { status: 400 },
    );
  }

  if ((input.attachments?.length ?? 0) > maxAttachmentsPerMessage) {
    return Response.json(
      {
        error: `Too many attachments (maximum ${maxAttachmentsPerMessage})`,
        code: "BAD_REQUEST",
      },
      { status: 400 },
    );
  }

  if (containsSpam(input)) {
    return Response.json(
      {
        error: "Message rejected: content flagged as spam or phishing",
        code: "SPAM_REJECTED",
      },
      { status: 400 },
    );
  }

  return withKeyedLock(`acct:${accountId}`, async () => {
    const { accounts } = await db.query({
      accounts: {
        $: { where: { id: accountId, "organization.id": orgId } },
        organization: { billingUser: {}, members: {} },
      },
    });
    const account = accounts[0];
    if (!account) {
      return Response.json(
        { error: "Account not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // deno-lint-ignore no-explicit-any
    const org: any = Array.isArray(account.organization)
      ? account.organization[0]
      : account.organization;
    const isAdmin = Boolean(org?.admin);

    const now = Date.now();
    const periodLengthMs = 30 * 24 * 60 * 60 * 1000;
    const isNewPeriod = !account.sendPeriodStart ||
      now - account.sendPeriodStart > periodLengthMs;
    const sendsInCurrentPeriod = isNewPeriod
      ? 0
      : (account.sendsThisMonth ?? 0);

    if (!isAdmin) {
      if (account.isFrozen || (account.expiresAt && account.expiresAt < now)) {
        return Response.json(
          {
            error:
              "Mailbox is expired or inactive. Please top up your balance.",
            code: "ACCOUNT_EXPIRED",
          },
          { status: 402 },
        );
      }

      const isPaying = isPayingOrg(org);
      const limits = isPaying
        ? planDetails.limits.paid
        : planDetails.limits.trial;

      const todayUtc = getUtcDayStart();
      const sendsToday = await countOutboundRecipientsSince(
        accountId,
        todayUtc,
      );
      const billingEmail = org?.billingUser?.email ||
        org?.members?.find((m: { email?: string }) => Boolean(m.email))?.email;

      if (sendsToday + recipientCount > limits.sendsPerDay) {
        notifyQuotaExceeded({
          orgId,
          accountAddress: account.address,
          accountId,
          quotaType: "daily_send",
          limit: limits.sendsPerDay,
          billingEmail,
          isPaying,
        }).catch((err) => console.error("[messages] Quota notify error:", err));

        return Response.json(
          {
            error:
              `Daily send limit reached (${limits.sendsPerDay} sends/day for ${
                isPaying ? "paid" : "trial"
              } accounts). Resets at 00:00 UTC.`,
            code: "DAILY_SEND_LIMIT_REACHED",
          },
          { status: 429 },
        );
      }

      if (sendsInCurrentPeriod + recipientCount > limits.sendsPerMonth) {
        notifyQuotaExceeded({
          orgId,
          accountAddress: account.address,
          accountId,
          quotaType: "monthly_send",
          limit: limits.sendsPerMonth,
          billingEmail,
          isPaying,
        }).catch((err) => console.error("[messages] Quota notify error:", err));

        return Response.json(
          {
            error:
              `Monthly send limit reached (${limits.sendsPerMonth.toLocaleString()} sends/month for ${
                isPaying ? "paid" : "trial"
              } accounts). ${
                isPaying
                  ? "Contact support@theagentmail.net if you need more."
                  : "Top up $5 to upgrade to a paid account with 1,000 sends/mo."
              }`,
            code: "SEND_LIMIT_REACHED",
          },
          { status: 429 },
        );
      }
    }

    const scanResult = await scanOutboundEmail(input, orgId);
    if (!scanResult.allowed) {
      return Response.json(
        {
          error: scanResult.reason ??
            "Message rejected: content flagged as spam or phishing",
          code: "SPAM_REJECTED",
        },
        { status: 400 },
      );
    }

    const from = account.address;
    const attachmentRecords: {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      storageKey: string;
    }[] = [];

    if (input.attachments) {
      let totalBytes = 0;
      for (const att of input.attachments) {
        const safeFilename = sanitizeAttachmentFilename(att.filename);
        const data = decodeBase64(att.content);
        totalBytes += data.byteLength;
        if (totalBytes > maxOutboundAttachmentBytes) {
          return Response.json(
            {
              error: "Attachments exceed maximum total size of 10MB",
              code: "BAD_REQUEST",
            },
            { status: 413 },
          );
        }
        const attId = id();
        const storageKey = `${orgId}/${accountId}/${attId}/${safeFilename}`;
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

    const result = (await sendEmail({
      from,
      to: [...input.to],
      cc: input.cc ? [...input.cc] : undefined,
      bcc: input.bcc ? [...input.bcc] : undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
      inReplyTo: input.inReplyTo,
      references: input.references,
      attachments: input.attachments?.map((a) => ({
        filename: sanitizeAttachmentFilename(a.filename),
        contentType: a.contentType,
        content: a.content,
      })),
    })) as { id?: string } | null;

    const messageId = id();
    // deno-lint-ignore no-explicit-any
    const txOps: any[] = [
      db.tx.messages[messageId]!.update({
        from,
        to: [...input.to],
        cc: input.cc ? [...input.cc] : undefined,
        bcc: input.bcc ? [...input.bcc] : undefined,
        subject: input.subject,
        bodyText: input.text ?? "",
        bodyHtml: input.html ?? "",
        direction: "outbound",
        status: "sent",
        timestamp: Date.now(),
        externalId: result?.id ?? "",
        inReplyTo: input.inReplyTo ?? "",
        references: input.references ?? "",
      }),
      db.tx.messages[messageId]!.link({ account: accountId }),
      db.tx.accounts[accountId]!.update({
        sendsThisMonth: sendsInCurrentPeriod + recipientCount,
        sendPeriodStart: isNewPeriod ? now : account.sendPeriodStart,
      }),
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
    captureEvent(orgId, "email_sent", {
      from,
      to: input.to,
      hasAttachments: attachmentRecords.length > 0,
    });

    return Response.json(
      {
        data: {
          id: messageId,
          from,
          to: input.to,
          subject: input.subject,
          status: "sent",
          timestamp: Date.now(),
        },
      } satisfies ApiResponse<unknown>,
      { status: 201 },
    );
  });
};

const listMessages = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId;
  if (!accountId) {
    return Response.json(
      { error: "accountId is required", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId, "organization.id": orgId } },
      messages: {},
    },
  });
  const account = accounts[0];
  if (!account) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json(
    {
      data: account.messages.map((m) => ({
        id: m.id,
        from: m.from,
        to: m.to,
        subject: m.subject,
        direction: m.direction,
        status: m.status,
        timestamp: m.timestamp,
      })),
    } satisfies ApiResponse<unknown>,
  );
};

const getMessage = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId;
  const messageId = params.messageId!;

  const { messages } = await db.query({
    messages: {
      $: { where: { id: messageId } },
      account: {
        organization: {},
      },
      attachments: {},
    },
  });
  const message = messages[0];

  if (!message) {
    return Response.json(
      { error: "Message not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // deno-lint-ignore no-explicit-any
  const rawMessage = message as any;
  const account = Array.isArray(rawMessage.account)
    ? rawMessage.account[0]
    : rawMessage.account;
  const organization = account
    ? (Array.isArray(account.organization)
      ? account.organization[0]
      : account.organization)
    : null;

  if (organization?.id !== orgId) {
    return Response.json(
      { error: "Message not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (accountId && account?.id !== accountId) {
    return Response.json(
      { error: "Message not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return Response.json(
    {
      data: {
        id: message.id,
        from: message.from,
        to: message.to,
        cc: message.cc || null,
        bcc: message.bcc || null,
        subject: message.subject,
        bodyText: message.bodyText || null,
        bodyHtml: message.bodyHtml || null,
        direction: message.direction,
        status: message.status,
        timestamp: message.timestamp,
        inReplyTo: message.inReplyTo || null,
        references: message.references || null,
        attachments: message.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      },
    } satisfies ApiResponse<unknown>,
  );
};

export { getMessage, listMessages, sendMessage };
