import { db } from "../db.ts";
import { getSignedUrl } from "../services/storage.ts";
import type { ApiResponse } from "../types.ts";

const getAttachmentUrl = async (
  _req: Request,
  params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const { accountId, messageId, attachmentId } = params;

  // Verify account belongs to org
  const { accounts } = await db.query({
    accounts: {
      $: { where: { id: accountId!, "organization.id": orgId } },
    },
  });
  if (!accounts[0]) {
    return Response.json(
      { error: "Account not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Verify message belongs to account
  const { messages } = await db.query({
    messages: {
      $: { where: { id: messageId!, "account.id": accountId! } },
    },
  });
  if (!messages[0]) {
    return Response.json(
      { error: "Message not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Get attachment
  const { attachments } = await db.query({
    attachments: {
      $: { where: { id: attachmentId!, "message.id": messageId! } },
    },
  });
  const attachment = attachments[0];
  if (!attachment) {
    return Response.json(
      { error: "Attachment not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const url = await getSignedUrl(attachment.storageKey);

  return Response.json({
    data: {
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      url,
    },
  } satisfies ApiResponse<unknown>);
};

export { getAttachmentUrl };
