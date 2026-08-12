import { coerce } from "gamla";

const resendApiKey = coerce(Deno.env.get("RESEND_API_KEY"));
const baseUrl = "https://api.resend.com";

const authHeader = () => `Bearer ${resendApiKey}`;

type SendEmailParams = {
  readonly from: string;
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly inReplyTo?: string;
  readonly references?: string;
  readonly attachments?: readonly {
    readonly filename: string;
    readonly contentType?: string;
    readonly content: string;
  }[];
};

const sendEmail = async (params: SendEmailParams): Promise<unknown> => {
  const res = await fetch(`${baseUrl}/emails`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      ...(params.cc && { cc: params.cc }),
      ...(params.bcc && { bcc: params.bcc }),
      subject: params.subject,
      text: params.text || params.html || params.subject || " ",
      ...(params.html && { html: params.html }),
      ...((params.inReplyTo || params.references) && {
        headers: {
          ...(params.inReplyTo && { "In-Reply-To": params.inReplyTo }),
          ...(params.references && { "References": params.references }),
        },
      }),
      ...(params.attachments && {
        attachments: params.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      }),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw {
      status: res.status,
      error: `Resend API error: ${body}`,
      code: "EMAIL_PROVIDER_ERROR",
    };
  }
  return res.json();
};

export { sendEmail };
export type { SendEmailParams };
