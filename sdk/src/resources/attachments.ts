import type { AttachmentWithUrl, ApiResponse } from "../types.ts";

export type AttachmentsResource = {
  readonly getUrl: (
    accountId: string,
    messageId: string,
    attachmentId: string,
  ) => Promise<AttachmentWithUrl>;
};

export const makeAttachments = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): AttachmentsResource => ({
  getUrl: (accountId, messageId, attachmentId) =>
    request<ApiResponse<AttachmentWithUrl>>(
      "GET",
      `/v1/accounts/${accountId}/messages/${messageId}/attachments/${attachmentId}`,
    ).then((r) => r.data),
});
