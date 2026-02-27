import type { KarmaBalance, ApiResponse } from "../types.ts";

export type KarmaResource = {
  readonly getBalance: () => Promise<KarmaBalance>;
};

export const makeKarma = (
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>,
): KarmaResource => ({
  getBalance: () =>
    request<ApiResponse<KarmaBalance>>("GET", "/v1/karma").then(
      (r) => r.data,
    ),
});
