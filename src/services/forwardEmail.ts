const FORWARD_EMAIL_API_KEY = Deno.env.get("FORWARD_EMAIL_API_KEY") ?? "";
const FORWARD_EMAIL_DOMAIN = Deno.env.get("FORWARD_EMAIL_DOMAIN") ??
  "theagentmail.net";
const BASE_URL = "https://api.forwardemail.net/v1";

const authHeader = () => `Basic ${btoa(`${FORWARD_EMAIL_API_KEY}:`)}`;

const request = async (
  path: string,
  options: RequestInit = {},
): Promise<unknown> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw {
      status: res.status,
      error: `Forward Email API error: ${body}`,
      code: "EMAIL_PROVIDER_ERROR",
    };
  }
  return res.status === 204 ? null : res.json();
};

// Alias management (email accounts)
const createAlias = async (
  name: string,
  recipients: readonly string[],
): Promise<unknown> => {
  try {
    return await request(`/domains/${FORWARD_EMAIL_DOMAIN}/aliases`, {
      method: "POST",
      body: JSON.stringify({
        name,
        recipients: [...recipients],
        has_recipient_verification: false,
      }),
    });
  } catch (e: unknown) {
    // If alias already exists, update it to point to our webhook instead of failing
    const err = e as { status?: number; error?: string };
    if (err.status === 400 && err.error?.includes("Alias already exists")) {
      return await request(`/domains/${FORWARD_EMAIL_DOMAIN}/aliases/${name}`, {
        method: "PUT",
        body: JSON.stringify({
          recipients: [...recipients],
          has_recipient_verification: false,
        }),
      });
    }
    throw e;
  }
};

const deleteAlias = (aliasId: string): Promise<unknown> =>
  request(`/domains/${FORWARD_EMAIL_DOMAIN}/aliases/${aliasId}`, {
    method: "DELETE",
  });

const getAlias = (aliasId: string): Promise<unknown> =>
  request(`/domains/${FORWARD_EMAIL_DOMAIN}/aliases/${aliasId}`);

// Sending email
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
    readonly contentType: string;
    readonly content: string;
  }[];
};

const sendEmail = (params: SendEmailParams): Promise<unknown> =>
  request("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: params.from,
      to: params.to.join(", "),
      ...(params.cc && { cc: params.cc.join(", ") }),
      ...(params.bcc && { bcc: params.bcc.join(", ") }),
      subject: params.subject,
      ...(params.text && { text: params.text }),
      ...(params.html && { html: params.html }),
      ...(params.inReplyTo && { in_reply_to: params.inReplyTo }),
      ...(params.references && { references: params.references }),
      ...(params.attachments && {
        attachments: params.attachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          content: a.content,
          encoding: "base64",
        })),
      }),
    }),
  });

export { createAlias, deleteAlias, FORWARD_EMAIL_DOMAIN, getAlias, sendEmail };
