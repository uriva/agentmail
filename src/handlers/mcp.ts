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

type McpToolAnnotations = {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
};

type McpToolDef = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: McpToolAnnotations;
};

const supportedProtocolVersions = new Set([
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);
const defaultProtocolVersion = "2025-03-26";
const serverInfo = { name: "agentmail", version: "0.2.1" };

const negotiateProtocolVersion = (params?: Record<string, unknown>): string => {
  const requested = typeof params?.protocolVersion === "string"
    ? params.protocolVersion
    : "";
  return supportedProtocolVersions.has(requested)
    ? requested
    : defaultProtocolVersion;
};

const jsonRpcResultBody = (id: JsonRpcId, result: unknown) => ({
  jsonrpc: "2.0",
  id,
  result,
});

const jsonRpcErrorBody = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

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
        title: "List Mailboxes",
        description:
          "List all @theagentmail.net mailboxes in your organization.",
        inputSchema: { type: "object", properties: {} },
        annotations: {
          title: "List Mailboxes",
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: "create_mailbox",
        title: "Create Mailbox",
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
        annotations: {
          title: "Create Mailbox",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      {
        name: "get_balance",
        title: "Get Prepaid Balance",
        description:
          "Check your organization's prepaid AgentMail wallet balance.",
        inputSchema: { type: "object", properties: {} },
        annotations: {
          title: "Get Prepaid Balance",
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
    ]),
  {
    name: "get_mailbox",
    title: "Get Mailbox Info",
    description: "Get mailbox address, status, expiration, and send count.",
    inputSchema: {
      type: "object",
      properties: { ...accountIdProp(scoped) },
      required: requiredWithAccount(scoped, []),
    },
    annotations: {
      title: "Get Mailbox Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "list_messages",
    title: "List Inbox Messages",
    description:
      "List recent inbound and outbound messages for the mailbox, newest first.",
    inputSchema: {
      type: "object",
      properties: { ...accountIdProp(scoped) },
      required: requiredWithAccount(scoped, []),
    },
    annotations: {
      title: "List Inbox Messages",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "get_message",
    title: "Read Email Message",
    description:
      "Read a single email message including full text/HTML body and attachment metadata.",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        messageId: {
          type: "string",
          description: "Unique message ID returned by list_messages.",
        },
      },
      required: requiredWithAccount(scoped, ["messageId"]),
    },
    annotations: {
      title: "Read Email Message",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "send_email",
    title: "Send Email",
    description:
      "Send an email from the agent mailbox (outbound mail is scanned in real time for spam/phishing).",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        to: {
          type: "array",
          items: { type: "string" },
          description: "Primary recipient email addresses.",
        },
        subject: { type: "string", description: "Email subject line." },
        text: { type: "string", description: "Plain text message body." },
        html: { type: "string", description: "Optional HTML message body." },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "Optional carbon-copy (CC) recipient email addresses.",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional blind carbon-copy (BCC) recipient email addresses.",
        },
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
    annotations: {
      title: "Send Email",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_attachment_url",
    title: "Get Attachment Download URL",
    description: "Get a 1-hour signed download URL for a message attachment.",
    inputSchema: {
      type: "object",
      properties: {
        ...accountIdProp(scoped),
        messageId: {
          type: "string",
          description: "Message ID containing the attachment.",
        },
        attachmentId: {
          type: "string",
          description: "Attachment ID from get_message metadata.",
        },
      },
      required: requiredWithAccount(scoped, ["messageId", "attachmentId"]),
    },
    annotations: {
      title: "Get Attachment Download URL",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "list_webhooks",
    title: "List Webhooks",
    description: "List inbound email webhook subscriptions for the mailbox.",
    inputSchema: {
      type: "object",
      properties: { ...accountIdProp(scoped) },
      required: requiredWithAccount(scoped, []),
    },
    annotations: {
      title: "List Webhooks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  ...(scoped
    ? []
    : [
      {
        name: "create_webhook",
        title: "Create Inbound Webhook",
        description:
          "Register an HTTPS webhook URL for real-time email.received events (org-scoped key required to prevent prompt-injected inbox forwarding).",
        inputSchema: {
          type: "object",
          properties: {
            ...accountIdProp(false),
            url: {
              type: "string",
              description:
                "HTTPS webhook endpoint URL that receives POST events.",
            },
          },
          required: requiredWithAccount(false, ["url"]),
        },
        annotations: {
          title: "Create Inbound Webhook",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      {
        name: "delete_webhook",
        title: "Delete Inbound Webhook",
        description:
          "Delete a webhook subscription by ID (org-scoped key required).",
        inputSchema: {
          type: "object",
          properties: {
            ...accountIdProp(false),
            webhookId: {
              type: "string",
              description: "Webhook subscription ID from list_webhooks.",
            },
          },
          required: requiredWithAccount(false, ["webhookId"]),
        },
        annotations: {
          title: "Delete Inbound Webhook",
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
    ]),
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
    return isOrg
      ? createWebhook(
        jsonReq("POST", { url: args.url }),
        { accountId },
        orgId,
      )
      : Promise.resolve(
        Response.json(
          {
            error:
              "Org-scoped API key or dashboard required to create webhooks over MCP",
            code: "FORBIDDEN",
          },
          { status: 403 },
        ),
      );
  }
  if (name === "delete_webhook") {
    return isOrg
      ? deleteWebhook(
        jsonReq("DELETE"),
        { accountId, webhookId: str(args.webhookId) },
        orgId,
      )
      : Promise.resolve(
        Response.json(
          {
            error:
              "Org-scoped API key or dashboard required to delete webhooks over MCP",
            code: "FORBIDDEN",
          },
          { status: 403 },
        ),
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

const processRpcMessage = async (
  rpc: JsonRpcRequest,
  orgId: string,
  accountId?: string,
): Promise<Record<string, unknown> | null> => {
  if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return jsonRpcErrorBody(null, -32600, "Invalid JSON-RPC request");
  }

  const hasId = Object.prototype.hasOwnProperty.call(rpc, "id") &&
    rpc.id !== undefined;
  const id = rpc.id ?? null;

  if (!hasId || rpc.method.startsWith("notifications/")) {
    return null;
  }
  if (rpc.method === "ping") {
    return jsonRpcResultBody(id, {});
  }
  if (rpc.method === "initialize") {
    return jsonRpcResultBody(id, {
      protocolVersion: negotiateProtocolVersion(rpc.params),
      capabilities: { tools: { listChanged: false } },
      serverInfo,
    });
  }
  if (rpc.method === "tools/list") {
    return jsonRpcResultBody(id, {
      tools: buildToolList(Boolean(accountId) || !orgId),
    });
  }
  if (rpc.method === "tools/call") {
    if (!orgId) {
      return {
        __unauthorized: true,
        ...jsonRpcErrorBody(
          id,
          -32001,
          "Authentication required: pass Authorization: Bearer am_...",
        ),
      };
    }
    const params = rpc.params ?? {};
    const name = str(params.name);
    const args = params.arguments && typeof params.arguments === "object"
      ? (params.arguments as Record<string, unknown>)
      : {};
    const pending = callToolHandler(name, args, orgId, accountId);
    if (!pending) {
      return jsonRpcErrorBody(id, -32601, `Unknown tool: ${name}`);
    }
    const res = await pending;
    return jsonRpcResultBody(id, await toToolResult(res));
  }

  return jsonRpcErrorBody(id, -32601, `Method not found: ${rpc.method}`);
};

export const handleMcpInfo = (req: Request): Promise<Response> => {
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  if (accept.includes("text/event-stream")) {
    return Promise.resolve(
      new Response(null, {
        status: 405,
        headers: { Allow: "POST, DELETE, OPTIONS" },
      }),
    );
  }
  return Promise.resolve(
    Response.json({
      name: serverInfo.name,
      version: serverInfo.version,
      transport: "streamable-http",
      endpoint: "https://api.theagentmail.net/mcp",
      authentication: "Authorization: Bearer am_...",
      docs: "https://theagentmail.net/docs#mcp",
      llmsTxt: "https://theagentmail.net/llms.txt",
      quickStart:
        'claude mcp add --transport http agentmail https://api.theagentmail.net/mcp --header "Authorization: Bearer am_..."',
    }),
  );
};

export const handleMcpDelete = (): Promise<Response> =>
  Promise.resolve(new Response(null, { status: 204 }));

export const handleMcp = async (
  req: Request,
  _params: Record<string, string>,
  orgId: string,
  accountId?: string,
): Promise<Response> => {
  const payload = (await req.json().catch(() => null)) as
    | JsonRpcRequest
    | JsonRpcRequest[]
    | null;

  if (!payload || typeof payload !== "object") {
    return Response.json(
      jsonRpcErrorBody(null, -32700, "Parse error"),
      { status: 400 },
    );
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return Response.json(
        jsonRpcErrorBody(null, -32600, "Empty batch"),
        { status: 400 },
      );
    }
    const results = (
      await Promise.all(
        payload.map((msg) => processRpcMessage(msg, orgId, accountId)),
      )
    ).filter((r): r is Record<string, unknown> => r !== null);
    return results.length === 0
      ? new Response(null, { status: 202 })
      : Response.json(results);
  }

  const result = await processRpcMessage(payload, orgId, accountId);
  if (result === null) {
    return new Response(null, { status: 202 });
  }
  if ("__unauthorized" in result) {
    const { __unauthorized: _, ...body } = result;
    return Response.json(body, {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="agentmail"' },
    });
  }
  return Response.json(result);
};
