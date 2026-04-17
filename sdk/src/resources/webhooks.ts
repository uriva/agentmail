import type { ApiResponse, CreateWebhookParams, Webhook } from "../types.ts";

export type WebhooksResource = {
  readonly create: (
    accountIdOrParams: string | CreateWebhookParams,
    params?: CreateWebhookParams,
  ) => Promise<Webhook>;
  readonly list: (accountId?: string) => Promise<readonly Webhook[]>;
  readonly delete: (
    accountIdOrWebhookId: string,
    webhookId?: string,
  ) => Promise<void>;
};

export const makeWebhooks = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): WebhooksResource => ({
  create: (accountIdOrParams, params?) => {
    const [path, body] = typeof accountIdOrParams === "string"
      ? [`/v1/accounts/${accountIdOrParams}/webhooks`, params!]
      : [`/v1/webhooks`, accountIdOrParams];
    return request<ApiResponse<Webhook>>("POST", path, body).then(
      (r) => r.data,
    );
  },
  list: (accountId?) =>
    request<ApiResponse<readonly Webhook[]>>(
      "GET",
      accountId ? `/v1/accounts/${accountId}/webhooks` : `/v1/webhooks`,
    ).then((r) => r.data),
  delete: (accountIdOrWebhookId, webhookId?) => {
    const path = webhookId
      ? `/v1/accounts/${accountIdOrWebhookId}/webhooks/${webhookId}`
      : `/v1/webhooks/${accountIdOrWebhookId}`;
    return request<void>("DELETE", path);
  },
});
