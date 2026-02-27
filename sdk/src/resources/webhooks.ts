import type {
  Webhook,
  CreateWebhookParams,
  ApiResponse,
} from "../types.ts";

export type WebhooksResource = {
  readonly create: (
    accountId: string,
    params: CreateWebhookParams,
  ) => Promise<Webhook>;
  readonly list: (accountId: string) => Promise<readonly Webhook[]>;
  readonly delete: (accountId: string, webhookId: string) => Promise<void>;
};

export const makeWebhooks = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): WebhooksResource => ({
  create: (accountId, params) =>
    request<ApiResponse<Webhook>>(
      "POST",
      `/v1/accounts/${accountId}/webhooks`,
      params,
    ).then((r) => r.data),
  list: (accountId) =>
    request<ApiResponse<readonly Webhook[]>>(
      "GET",
      `/v1/accounts/${accountId}/webhooks`,
    ).then((r) => r.data),
  delete: (accountId, webhookId) =>
    request<void>(
      "DELETE",
      `/v1/accounts/${accountId}/webhooks/${webhookId}`,
    ),
});
