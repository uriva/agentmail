import type { ApiError, ClientConfig } from "./types.ts";
import { type AccountsResource, makeAccounts } from "./resources/accounts.ts";
import { makeMessages, type MessagesResource } from "./resources/messages.ts";
import {
  type AttachmentsResource,
  makeAttachments,
} from "./resources/attachments.ts";
import { makeWebhooks, type WebhooksResource } from "./resources/webhooks.ts";
import { type KarmaResource, makeKarma } from "./resources/karma.ts";

export type {
  Account,
  ApiError,
  AttachmentInput,
  AttachmentMeta,
  AttachmentWithUrl,
  ClientConfig,
  CreateAccountParams,
  CreateWebhookParams,
  KarmaBalance,
  KarmaEvent,
  Message,
  MessageDetail,
  SendMessageParams,
  Webhook,
} from "./types.ts";

export type { AccountsResource } from "./resources/accounts.ts";
export type { MessagesResource } from "./resources/messages.ts";
export type { AttachmentsResource } from "./resources/attachments.ts";
export type { WebhooksResource } from "./resources/webhooks.ts";
export type { KarmaResource } from "./resources/karma.ts";

const DEFAULT_BASE_URL = "https://api.theagentmail.net";

class AgentMailError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AgentMailError";
    this.code = code;
    this.status = status;
  }
}

export type AgentMailClient = {
  readonly accounts: AccountsResource;
  readonly messages: MessagesResource;
  readonly attachments: AttachmentsResource;
  readonly webhooks: WebhooksResource;
  readonly karma: KarmaResource;
};

const createClient = (config: ClientConfig): AgentMailClient => {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();

    if (!response.ok) {
      const err = json as ApiError;
      throw new AgentMailError(
        err.error ?? "Unknown error",
        err.code ?? "UNKNOWN",
        response.status,
      );
    }

    return json as T;
  };

  return {
    accounts: makeAccounts(request),
    messages: makeMessages(request),
    attachments: makeAttachments(request),
    webhooks: makeWebhooks(request),
    karma: makeKarma(request),
  };
};

export { AgentMailError, createClient };
