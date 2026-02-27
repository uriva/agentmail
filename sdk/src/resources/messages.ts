import type {
  Message,
  MessageDetail,
  SendMessageParams,
  ApiResponse,
} from "../types.ts";

export type MessagesResource = {
  readonly send: (
    accountId: string,
    params: SendMessageParams,
  ) => Promise<Message>;
  readonly list: (accountId: string) => Promise<readonly Message[]>;
  readonly get: (accountId: string, messageId: string) => Promise<MessageDetail>;
};

export const makeMessages = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): MessagesResource => ({
  send: (accountId, params) =>
    request<ApiResponse<Message>>(
      "POST",
      `/v1/accounts/${accountId}/messages`,
      params,
    ).then((r) => r.data),
  list: (accountId) =>
    request<ApiResponse<readonly Message[]>>(
      "GET",
      `/v1/accounts/${accountId}/messages`,
    ).then((r) => r.data),
  get: (accountId, messageId) =>
    request<ApiResponse<MessageDetail>>(
      "GET",
      `/v1/accounts/${accountId}/messages/${messageId}`,
    ).then((r) => r.data),
});
