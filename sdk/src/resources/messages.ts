import type {
  Message,
  MessageDetail,
  SendMessageParams,
  ApiResponse,
} from "../types.ts";

export type MessagesResource = {
  readonly send: (
    accountIdOrParams: string | SendMessageParams,
    params?: SendMessageParams,
  ) => Promise<Message>;
  readonly list: (accountId?: string) => Promise<readonly Message[]>;
  readonly get: (
    accountIdOrMessageId: string,
    messageId?: string,
  ) => Promise<MessageDetail>;
};

export const makeMessages = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): MessagesResource => ({
  send: (accountIdOrParams, params?) => {
    const [path, body] =
      typeof accountIdOrParams === "string"
        ? [`/v1/accounts/${accountIdOrParams}/messages`, params!]
        : [`/v1/messages`, accountIdOrParams];
    return request<ApiResponse<Message>>("POST", path, body).then(
      (r) => r.data,
    );
  },
  list: (accountId?) =>
    request<ApiResponse<readonly Message[]>>(
      "GET",
      accountId ? `/v1/accounts/${accountId}/messages` : `/v1/messages`,
    ).then((r) => r.data),
  get: (accountIdOrMessageId, messageId?) => {
    const path = messageId
      ? `/v1/accounts/${accountIdOrMessageId}/messages/${messageId}`
      : `/v1/messages/${accountIdOrMessageId}`;
    return request<ApiResponse<MessageDetail>>("GET", path).then(
      (r) => r.data,
    );
  },
});
