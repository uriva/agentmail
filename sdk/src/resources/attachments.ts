import type { ApiResponse, AttachmentWithUrl } from "../types.ts";

export type AttachmentsResource = {
  readonly getUrl: (
    accountIdOrMessageId: string,
    messageIdOrAttachmentId: string,
    attachmentId?: string,
  ) => Promise<AttachmentWithUrl>;
};

export const makeAttachments = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): AttachmentsResource => ({
  getUrl: (accountIdOrMessageId, messageIdOrAttachmentId, attachmentId?) => {
    const path = attachmentId
      ? `/v1/accounts/${accountIdOrMessageId}/messages/${messageIdOrAttachmentId}/attachments/${attachmentId}`
      : `/v1/messages/${accountIdOrMessageId}/attachments/${messageIdOrAttachmentId}`;
    return request<ApiResponse<AttachmentWithUrl>>("GET", path).then(
      (r) => r.data,
    );
  },
});
