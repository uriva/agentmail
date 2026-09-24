// SDK types — mirrors the API response shapes

export type Account = {
  readonly id: string;
  readonly address: string;
  readonly displayName: string | null;
  readonly createdAt: number;
};

export type CreateAccountParams = {
  readonly address: string;
  readonly displayName?: string;
};

export type Message = {
  readonly id: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly direction: "inbound" | "outbound";
  readonly status: "queued" | "sent" | "delivered" | "failed" | "received";
  readonly timestamp: number;
};

export type MessageDetail = Message & {
  readonly cc: readonly string[] | null;
  readonly bcc: readonly string[] | null;
  readonly bodyText: string | null;
  readonly bodyHtml: string | null;
  readonly inReplyTo: string | null;
  readonly references: string | null;
  readonly attachments: readonly AttachmentMeta[];
};

export type AttachmentMeta = {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
};

export type AttachmentWithUrl = AttachmentMeta & {
  readonly url: string;
};

export type SendMessageParams = {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly inReplyTo?: string;
  readonly references?: string;
  readonly attachments?: readonly AttachmentInput[];
};

export type AttachmentInput = {
  readonly filename: string;
  readonly contentType: string;
  readonly content: string; // base64 encoded
};

export type Webhook = {
  readonly id: string;
  readonly url: string;
  readonly secret?: string;
  readonly active: boolean;
  readonly createdAt?: number;
};

export type CreateWebhookParams = {
  readonly url: string;
  readonly secret?: string;
};

export type ApiResponse<T> = {
  readonly data: T;
};

export type ApiError = {
  readonly error: string;
  readonly code: string;
};

export type ClientConfig = {
  readonly apiKey: string;
  readonly baseUrl?: string;
};
