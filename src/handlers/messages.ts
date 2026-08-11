import { db, id } from "../db.ts";
import type { ApiResponse, SendEmailInput } from "../types.ts";
import { recordKarmaEvent, requireKarmaForSend } from "../services/karma.ts";
import { FORWARD_EMAIL_DOMAIN, sendEmail } from "../services/forwardEmail.ts";
import { uploadFile } from "../services/storage.ts";
import { captureEvent } from "../services/posthog.ts";

const SPAM_PATTERNS = [
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
  const content = `${input.subject ?? ""} ${input.text ?? ""} ${input.html ?? ""}`.toLowerCase();
  return SPAM_PATTERNS.some((pattern) => content.includes(pattern.toLowerCase()));
};

const sendMessage = async (
  req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId!;

  // Verify account belongs to org
  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId, "organization.id": orgId } },
    },
  });
  const account = accounts[0];
  if (!account) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await requireKarmaForSend(orgId);

  const input = (await req.json()) as SendEmailInput;

  if (containsSpam(input)) {
    return Response.json(
      { error: "Message rejected: content flagged as spam or phishing", code: "SPAM_REJECTED" },
      { status: 400 },
    );
  }
  const from = account.address;

  // Upload attachments to GCS
  const attachmentRecords: {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    storageKey: string;
  }[] = [];

  if (input.attachments) {
    for (const att of input.attachments) {
      const attId = id();
      const storageKey = `${orgId}/${accountId}/${attId}/${att.filename}`;
      const data = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));
      await uploadFile(storageKey, data, att.contentType);
      attachmentRecords.push({
        id: attId,
        filename: att.filename,
        contentType: att.contentType,
        size: data.byteLength,
        storageKey,
      });
    }
  }

  // Send via Forward Email
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
      filename: a.filename,
      contentType: a.contentType,
      content: a.content,
    })),
  })) as { id?: string } | null;

  // Store message in DB
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
  ];

  // Link attachments
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
  await recordKarmaEvent(orgId, "email_sent", { messageId, to: input.to });
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
};

const listMessages = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const accountId = params.accountId!;

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
