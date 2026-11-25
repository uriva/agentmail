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
      ? `/v1/accounts/${encodeURIComponent(accountIdOrMessageId)}/messages/${
        encodeURIComponent(messageIdOrAttachmentId)
      }/attachments/${encodeURIComponent(attachmentId)}`
      : `/v1/messages/${encodeURIComponent(accountIdOrMessageId)}/attachments/${
        encodeURIComponent(messageIdOrAttachmentId)
      }`;
    return request<ApiResponse<AttachmentWithUrl>>("GET", path).then(
      (r) => r.data,
    );
  },
});
