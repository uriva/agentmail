import { createAccount, getAccount, listAccounts } from "./accounts.ts";
import { getAttachmentUrl } from "./attachments.ts";
import { getBillingBalance } from "./billing.ts";
import { getMessage, listMessages, sendMessage } from "./messages.ts";
import { createWebhook, deleteWebhook, listWebhooks } from "./webhooks.ts";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  readonly jsonrpc?: string;
  readonly id?: JsonRpcId;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
};

type McpToolDef = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
};

const mcpProtocolVersion = "2025-03-26";
const serverInfo = { name: "agentmail", version: "0.2.0" };

const jsonRpcResult = (id: JsonRpcId, result: unknown): Response =>
  Response.json({ jsonrpc: "2.0", id, result });

const jsonRpcError = (
  id: JsonRpcId,
  code: number,
  message: string,
  status = 200,
): Response =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });

const accountIdProp = (scoped: boolean): Record<string, unknown> =>
  scoped
    ? {}
    : {
      accountId: {
        type: "string",
        description:
          "Mailbox account ID (required for org-scoped API keys; omit for account-scoped keys).",
      },
    };

const requiredWithAccount = (
  scoped: boolean,
  fields: readonly string[],
): readonly string[] => (scoped ? fields : ["accountId", ...fields]);

const buildToolList = (scoped: boolean): readonly McpToolDef[] => [
  ...(scoped
    ? []
    : [
      {
        name: "list_mailboxes",
        description: "List all @theagentmail.net mailboxes in your organization.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "create_mailbox",
        description:
          "Create a new @theagentmail.net mailbox (first mailbox free 30d after phone verification; additional $1/mo from balance).",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Local-part or full address, e.g. 'deploy-bot'.",
            },
            displayName: {
              type: "string",
              description: "Optional display name for outbound mail.",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "get_balance",
        description: "Check your organization's prepaid AgentMail wallet balance.",
        inputSchema: { type: "object", properties: {} },
      },
    ]),
  {
    name: "get_mailbox",
    description: "Get mailbox address, status, expiration, and send count.",
    inputSchema: {
      type: "object",
      properties: { ...accountIdProp(scoped) },
      required: requiredWithAccount(scoped, []),
    },
  },
  {
    name: "list_messages",
    description:
      "List recent inbound and outbound messages for the mailbox, newest first.",
    inputSchema: {
      type: "object",
      properties: { ...accountIdProp(scoped) },
      required: requiredWithAccount(scoped, []),
    },
  },
  {
    name: "get_message",
    description:
      "Read a single email message including full text/HTML body and attachment metadata.",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        messageId: { type: "string", description: "Message ID from list_messages." },
      },
      required: requiredWithAccount(scoped, ["messageId"]),
    },
  },
  {
    name: "send_email",
    description:
      "Send an email from the agent mailbox (outbound mail is scanned in real time for spam/phishing).",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        to: {
          type: "array",
          items: { type: "string" },
          description: "Recipient email addresses.",
        },
        subject: { type: "string", description: "Email subject line." },
        text: { type: "string", description: "Plain text body." },
        html: { type: "string", description: "Optional HTML body." },
        cc: { type: "array", items: { type: "string" } },
        bcc: { type: "array", items: { type: "string" } },
        inReplyTo: {
          type: "string",
          description: "Optional Message-ID header for threading replies.",
        },
        references: {
          type: "string",
          description: "Optional References header for threading replies.",
        },
      },
      required: requiredWithAccount(scoped, ["to", "subject", "text"]),
    },
  },
  {
    name: "get_attachment_url",
    description: "Get a 1-hour signed download URL for a message attachment.",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        messageId: { type: "string" },
        attachmentId: { type: "string" },
      },
      required: requiredWithAccount(scoped, ["messageId", "attachmentId"]),
    },
  },
  {
    name: "list_webhooks",
    description: "List inbound email webhook subscriptions for the mailbox.",
    inputSchema: {
      type: "object",
      properties: { ...accountIdProp(scoped) },
      required: requiredWithAccount(scoped, []),
    },
  },
  {
    name: "create_webhook",
    description: "Register an HTTPS webhook URL for real-time email.received events.",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        url: { type: "string", description: "HTTPS webhook endpoint URL." },
      },
      required: requiredWithAccount(scoped, ["url"]),
    },
  },
  {
    name: "delete_webhook",
    description: "Delete a webhook subscription by ID.",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        webhookId: { type: "string" },
      },
      required: requiredWithAccount(scoped, ["webhookId"]),
    },
  },
];

const jsonReq = (method: string, body?: unknown): Request =>
  new Request("https://api.theagentmail.net/mcp", {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const resolveAccountId = (
  args: Record<string, unknown>,
  scopedAccountId?: string,
): string | null =>
  scopedAccountId
    ? (!args.accountId || str(args.accountId) === scopedAccountId
      ? scopedAccountId
      : null)
    : (str(args.accountId) || null);

const callToolHandler = (
  name: string,
  args: Record<string, unknown>,
  orgId: string,
  scopedAccountId?: string,
): Promise<Response> | null => {
  const isOrg = !scopedAccountId;
  if (name === "list_mailboxes") {
    return isOrg
      ? listAccounts(jsonReq("GET"), {}, orgId)
      : Promise.resolve(
        Response.json(
          { error: "Org-scoped API key required", code: "FORBIDDEN" },
          { status: 403 },
        ),
      );
  }
  if (name === "create_mailbox") {
    return isOrg
      ? createAccount(
        jsonReq("POST", {
          address: args.address,
          displayName: args.displayName,
        }),
        {},
        orgId,
      )
      : Promise.resolve(
        Response.json(
          { error: "Org-scoped API key required", code: "FORBIDDEN" },
          { status: 403 },
        ),
      );
  }
  if (name === "get_balance") {
    return isOrg
      ? getBillingBalance(jsonReq("GET"), {}, orgId)
      : Promise.resolve(
        Response.json(
          { error: "Org-scoped API key required", code: "FORBIDDEN" },
          { status: 403 },
        ),
      );
  }

  const accountId = resolveAccountId(args, scopedAccountId);
  if (!accountId) {
    return Promise.resolve(
      Response.json(
        {
          error: scopedAccountId
            ? "Account-scoped token cannot access another account"
            : "accountId is required for org-scoped API keys",
          code: scopedAccountId ? "FORBIDDEN" : "BAD_REQUEST",
        },
        { status: scopedAccountId ? 403 : 400 },
      ),
    );
  }

  if (name === "get_mailbox") {
    return getAccount(jsonReq("GET"), { accountId }, orgId);
  }
  if (name === "list_messages") {
    return listMessages(jsonReq("GET"), { accountId }, orgId);
  }
  if (name === "get_message") {
    return getMessage(
      jsonReq("GET"),
      { accountId, messageId: str(args.messageId) },
      orgId,
    );
  }
  if (name === "send_email") {
    return sendMessage(
      jsonReq("POST", {
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        text: args.text,
        html: args.html,
        inReplyTo: args.inReplyTo,
        references: args.references,
      }),
      { accountId },
      orgId,
    );
  }
  if (name === "get_attachment_url") {
    return getAttachmentUrl(
      jsonReq("GET"),
      {
        accountId,
        messageId: str(args.messageId),
        attachmentId: str(args.attachmentId),
      },
      orgId,
    );
  }
  if (name === "list_webhooks") {
    return listWebhooks(jsonReq("GET"), { accountId }, orgId);
  }
  if (name === "create_webhook") {
    return createWebhook(
      jsonReq("POST", { url: args.url }),
      { accountId },
      orgId,
    );
  }
  if (name === "delete_webhook") {
    return deleteWebhook(
      jsonReq("DELETE"),
      { accountId, webhookId: str(args.webhookId) },
      orgId,
    );
  }
  return null;
};

const toToolResult = async (res: Response) => {
  const text = await res.text();
  return {
    content: [{ type: "text", text: text || JSON.stringify({ ok: res.ok }) }],
    isError: !res.ok,
  };
};

export const handleMcp = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
  accountId?: string,
): Promise<Response> => {
  const rpc = (await req.json().catch(() => null)) as JsonRpcRequest | null;
  if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request", 400);
  }

  const id = rpc.id ?? null;

  if (rpc.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }
  if (rpc.method === "ping") {
    return jsonRpcResult(id, {});
  }
  if (rpc.method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: mcpProtocolVersion,
      capabilities: { tools: {} },
      serverInfo,
    });
  }
  if (rpc.method === "tools/list") {
    return jsonRpcResult(id, { tools: buildToolList(Boolean(accountId)) });
  }
  if (rpc.method === "tools/call") {
    const params = rpc.params ?? {};
    const name = str(params.name);
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};
    const pending = callToolHandler(name, args, orgId, accountId);
    if (!pending) {
      return jsonRpcError(id, -32601, `Unknown tool: ${name}`);
    }
    const res = await pending;
    return jsonRpcResult(id, await toToolResult(res));
  }

  return jsonRpcError(id, -32601, `Method not found: ${rpc.method}`);
};
