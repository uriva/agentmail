export type MessageDirection = "inbound" | "outbound";

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received"
  | "spam";

export type CreateAccountInput = {
  readonly address: string;
  readonly displayName?: string;
};

export type SendEmailInput = {
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

export type CreateWebhookInput = {
  readonly url: string;
  readonly secret?: string;
};

export type InboundEmail = {
  readonly from: string;
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Record<string, string>;
  readonly messageId?: string;
  readonly inReplyTo?: string;
  readonly references?: string;
  readonly attachments?: readonly InboundAttachment[];
};

export type InboundAttachment = {
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly content: string; // base64 encoded
};

export type ApiResponse<T> = {
  readonly data: T;
};

export type ApiError = {
  readonly error: string;
  readonly code: string;
};

export type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  orgId: string,
) => Promise<Response>;

export type Route = {
  readonly method: string;
  readonly pattern: URLPattern;
  readonly handler: RouteHandler;
  readonly requiresAuth: boolean;
};
