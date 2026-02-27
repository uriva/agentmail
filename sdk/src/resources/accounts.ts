import type { Account, CreateAccountParams, ApiResponse } from "../types.ts";

export type AccountsResource = {
  readonly create: (params: CreateAccountParams) => Promise<Account>;
  readonly list: () => Promise<readonly Account[]>;
  readonly get: (accountId?: string) => Promise<Account>;
  readonly delete: (accountId?: string) => Promise<void>;
};

export const makeAccounts = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): AccountsResource => ({
  create: (params) =>
    request<ApiResponse<Account>>("POST", "/v1/accounts", params).then(
      (r) => r.data,
    ),
  list: () =>
    request<ApiResponse<readonly Account[]>>("GET", "/v1/accounts").then(
      (r) => r.data,
    ),
  get: (accountId?) =>
    request<ApiResponse<Account>>(
      "GET",
      accountId ? `/v1/accounts/${accountId}` : `/v1/account`,
    ).then((r) => r.data),
  delete: (accountId?) =>
    request<void>(
      "DELETE",
      accountId ? `/v1/accounts/${accountId}` : `/v1/account`,
    ),
});
