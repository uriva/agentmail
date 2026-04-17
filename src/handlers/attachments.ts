import { db } from "../db.ts";
import { getSignedUrl } from "../services/storage.ts";
import type { ApiResponse } from "../types.ts";

const getAttachmentUrl = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { accountId, messageId, attachmentId } = params;

  // Get attachment with nested relations
  const { attachments } = await db.query({
    attachments: {
      $: { where: { id: attachmentId! } },
      message: {
        account: {
          organization: {},
        },
      },
    },
  });
  const attachment = attachments[0];
  if (!attachment) {
    return Response.json(
      { error: "Attachment not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // deno-lint-ignore no-explicit-any
  const rawAtt = attachment as any;
  const message = Array.isArray(rawAtt.message)
    ? rawAtt.message[0]
    : rawAtt.message;
  const account = message
    ? (Array.isArray(message.account) ? message.account[0] : message.account)
    : null;
  const organization = account
    ? (Array.isArray(account.organization)
      ? account.organization[0]
      : account.organization)
    : null;

  if (organization?.id !== orgId) {
    return Response.json(
      { error: "Attachment not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (message?.id !== messageId) {
    return Response.json(
      { error: "Attachment not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (accountId && account?.id !== accountId) {
    return Response.json(
      { error: "Attachment not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const url = await getSignedUrl(attachment.storageKey);

  return Response.json(
    {
      data: {
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        url,
      },
    } satisfies ApiResponse<unknown>,
  );
};

export { getAttachmentUrl };
