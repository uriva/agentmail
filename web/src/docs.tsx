import type { ComponentChildren } from "preact";
import { useRef, useEffect } from "preact/hooks";
import {
  KARMA_AMOUNTS,
  INITIAL_KARMA,
  formatKarma,
} from "../../src/karma-constants.ts";

const CodeBlock = ({
  code,
  lang = "bash",
}: {
  code: string;
  lang?: string;
}) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // @ts-ignore: Prism loaded via CDN
    if (ref.current && globalThis.Prism) {
      // @ts-ignore
      globalThis.Prism.highlightElement(ref.current);
    }
  }, [code]);
  return (
    <pre class="bg-slate-900 border border-slate-700 rounded-xl p-5 overflow-x-auto text-sm leading-relaxed">
      <code ref={ref} class={`language-${lang}`}>
        {code}
      </code>
    </pre>
  );
};

const Section = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: preact.ComponentChildren;
}) => (
  <section id={id} class="scroll-mt-20 mb-16">
    <h2 class="text-2xl font-bold text-white mb-6 pb-2 border-b border-slate-700">
      {title}
    </h2>
    {children}
  </section>
);

const Endpoint = ({
  method,
  path,
  description,
  karma,
  children,
}: {
  method: string;
  path: string;
  description: string;
  karma?: string;
  children?: preact.ComponentChildren;
}) => {
  const methodColor =
    method === "GET"
      ? "text-green-400 bg-green-400/10"
      : method === "POST"
        ? "text-blue-400 bg-blue-400/10"
        : method === "DELETE"
          ? "text-red-400 bg-red-400/10"
          : "text-yellow-400 bg-yellow-400/10";
  return (
    <div class="mb-8 last:mb-0">
      <div class="flex items-center gap-3 mb-2 flex-wrap">
        <span
          class={`font-mono text-xs font-bold px-2 py-0.5 rounded ${methodColor} w-16 text-center`}
        >
          {method}
        </span>
        <code class="text-sm text-white">{path}</code>
        {karma && (
          <span class="text-xs font-mono text-slate-400">{karma}</span>
        )}
      </div>
      <p class="text-slate-400 text-sm mb-3">{description}</p>
      {children}
    </div>
  );
};

const TocLink = ({ href, children }: { href: string; children: string }) => (
  <a
    href={href}
    class="text-slate-400 hover:text-white transition-colors text-sm"
  >
    {children}
  </a>
);

const Docs = () => (
  <div class="max-w-3xl mx-auto">
    <h1 class="text-4xl font-bold text-white mb-2">API Documentation</h1>
    <p class="text-slate-400 mb-8">
      Base URL:{" "}
      <code class="text-white bg-slate-800 px-2 py-0.5 rounded">
        https://api.theagentmail.net
      </code>
    </p>

    {/* Table of contents */}
    <nav class="mb-12 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <TocLink href="#getting-started">Getting started</TocLink>
        <TocLink href="#authentication">Authentication</TocLink>
        <TocLink href="#accounts">Accounts</TocLink>
        <TocLink href="#messages">Messages</TocLink>
        <TocLink href="#attachments">Attachments</TocLink>
        <TocLink href="#webhooks">Webhooks</TocLink>
        <TocLink href="#karma">Karma</TocLink>
        <TocLink href="#organizations">Organizations</TocLink>
        <TocLink href="#errors">Errors</TocLink>
        <TocLink href="#sdk">TypeScript SDK</TocLink>
        <TocLink href="#opencode">OpenCode skill</TocLink>
      </div>
    </nav>

    {/* Getting started */}
    <Section id="getting-started" title="Getting started">
      <div class="text-slate-400 space-y-4 text-sm">
        <p>
          AgentMail gives your AI agent its own email address. Here's how to set
          it up.
        </p>

        <div class="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 class="text-white font-medium mb-2">
            1. Sign in and create an org
          </h4>
          <p>
            <a href="/login" class="text-blue-400 hover:text-blue-300">
              Sign in
            </a>{" "}
            with your personal email (Gmail, Outlook, ProtonMail, etc.). Then
            create an organization from the{" "}
            <a href="/app" class="text-blue-400 hover:text-blue-300">
              dashboard
            </a>
            . You'll need an org admin token for the next step -- generate one
            from the Admin section.
          </p>
        </div>

        <div class="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 class="text-white font-medium mb-2">
            2. Create an email account for your agent
          </h4>
          <CodeBlock
            code={`curl -X POST https://api.theagentmail.net/v1/accounts \\
  -H "Authorization: Bearer am_org_..." \\
  -H "Content-Type: application/json" \\
  -d '{"address": "my-agent@theagentmail.net"}'`}
          />
        </div>

        <div class="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 class="text-white font-medium mb-2">
            3. Create a token scoped to that account
          </h4>
          <p class="mb-3">
            Use the account ID from the previous response. This token only has
            access to this one mailbox -- safe to give to your agent.
          </p>
          <CodeBlock
            code={`curl -X POST https://api.theagentmail.net/v1/accounts/ACCOUNT_ID/api-keys \\
  -H "Authorization: Bearer am_org_..." \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-agent-key"}'`}
          />
          <p class="text-slate-500 text-xs mt-2">
            Save the <code class="text-white">key</code> from the response.
            It's only shown once.
          </p>
        </div>

        <div class="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 class="text-white font-medium mb-2">
            4. Give your agent the token and this docs page
          </h4>
          <p>
            Pass the account token and{" "}
            <code class="text-white">
              https://api.theagentmail.net/docs
            </code>{" "}
            to your AI agent. It can read the API reference and start sending and
            receiving email on its own.
          </p>
        </div>
      </div>
    </Section>

    {/* Authentication */}
    <Section id="authentication" title="Authentication">
      <div class="text-slate-400 space-y-3 text-sm">
        <p>
          All API endpoints require a Bearer token in the Authorization header.
        </p>
        <CodeBlock code={`Authorization: Bearer am_...`} />
        <p>There are two types of tokens:</p>
        <div class="space-y-4 mt-4">
          <div class="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 class="text-white font-medium mb-1">Org tokens</h4>
            <p>
              Full access to all accounts in your organization. Create and
              delete accounts, send and receive email, manage webhooks, check
              karma. Created from the dashboard.
            </p>
          </div>
          <div class="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 class="text-white font-medium mb-1">Account tokens</h4>
            <p>
              Scoped to a single email account. Can send and receive email,
              manage webhooks, and view account info. Cannot access other
              accounts or org-level endpoints (returns 403). Created
              programmatically via{" "}
              <code class="text-white">
                POST /v1/accounts/:id/api-keys
              </code>
              .
            </p>
          </div>
        </div>
      </div>
    </Section>

    {/* Accounts */}
    <Section id="accounts" title="Accounts">
      <Endpoint
        method="POST"
        path="/v1/accounts"
        description={`Create a new email account. Costs ${Math.abs(KARMA_AMOUNTS.account_created)} karma.`}
        karma={`${formatKarma(KARMA_AMOUNTS.account_created)} karma`}
      >
        <p class="text-xs text-slate-500 mb-2">Request body</p>
        <CodeBlock
          lang="json"
          code={`{
  "address": "my-agent@theagentmail.net",
  "displayName": "My Agent"  // optional
}`}
        />
        <p class="text-xs text-slate-500 mt-4 mb-2">Response (201)</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "id": "abc123",
    "address": "my-agent@theagentmail.net",
    "displayName": "My Agent",
    "createdAt": 1709136000000
  }
}`}
        />
        <p class="text-slate-500 text-xs mt-2">
          Reserved addresses (<code>uri</code>, <code>support</code>) cannot be
          created.
        </p>
      </Endpoint>

      <Endpoint
        method="GET"
        path="/v1/accounts"
        description="List all email accounts in your organization."
      >
        <p class="text-xs text-slate-500 mb-2">Response</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": [
    {
      "id": "abc123",
      "address": "my-agent@theagentmail.net",
      "displayName": "My Agent",
      "createdAt": 1709136000000
    }
  ]
}`}
        />
      </Endpoint>

      <Endpoint
        method="GET"
        path="/v1/accounts/:accountId"
        description="Get details for a specific account."
      />

      <Endpoint
        method="DELETE"
        path="/v1/accounts/:accountId"
        description={`Delete an email account. Refunds ${KARMA_AMOUNTS.account_deleted} karma.`}
        karma={`${formatKarma(KARMA_AMOUNTS.account_deleted)} karma`}
      >
        <p class="text-slate-500 text-xs">
          Messages are retained for reference. The address becomes available
          for reuse.
        </p>
      </Endpoint>
    </Section>

    {/* Messages */}
    <Section id="messages" title="Messages">
      <Endpoint
        method="POST"
        path="/v1/accounts/:accountId/messages"
        description={`Send an email from this account. Costs ${Math.abs(KARMA_AMOUNTS.email_sent)} karma.`}
        karma={`${formatKarma(KARMA_AMOUNTS.email_sent)} karma`}
      >
        <p class="text-xs text-slate-500 mb-2">Request body</p>
        <CodeBlock
          lang="json"
          code={`{
  "to": ["human@example.com"],
  "cc": ["other@example.com"],       // optional
  "bcc": ["hidden@example.com"],     // optional
  "subject": "Hello from my agent",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",        // optional
  "inReplyTo": "<msgid@example>",    // optional, for threading
  "references": "<msgid@example>",   // optional
  "attachments": [                   // optional
    {
      "filename": "report.pdf",
      "contentType": "application/pdf",
      "content": "base64-encoded-data"
    }
  ]
}`}
        />
        <p class="text-xs text-slate-500 mt-4 mb-2">Response (201)</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "id": "msg_123",
    "from": "my-agent@theagentmail.net",
    "to": ["human@example.com"],
    "subject": "Hello from my agent",
    "direction": "outbound",
    "status": "queued",
    "timestamp": 1709136000000
  }
}`}
        />
      </Endpoint>

      <Endpoint
        method="GET"
        path="/v1/accounts/:accountId/messages"
        description="List all messages (inbound and outbound) for this account, sorted by most recent first."
      >
        <p class="text-xs text-slate-500 mb-2">Response</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": [
    {
      "id": "msg_123",
      "from": "sender@gmail.com",
      "to": ["my-agent@theagentmail.net"],
      "subject": "Re: Hello",
      "direction": "inbound",
      "status": "received",
      "timestamp": 1709137000000
    }
  ]
}`}
        />
      </Endpoint>

      <Endpoint
        method="GET"
        path="/v1/accounts/:accountId/messages/:messageId"
        description="Get a single message with full body content and attachment metadata."
      >
        <p class="text-xs text-slate-500 mb-2">Response</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "id": "msg_123",
    "from": "sender@gmail.com",
    "to": ["my-agent@theagentmail.net"],
    "subject": "Re: Hello",
    "text": "Full message body...",
    "html": "<p>Full HTML body...</p>",
    "direction": "inbound",
    "status": "received",
    "timestamp": 1709137000000,
    "attachments": [
      {
        "id": "att_456",
        "filename": "photo.jpg",
        "contentType": "image/jpeg",
        "size": 245000
      }
    ]
  }
}`}
        />
      </Endpoint>
    </Section>

    {/* Attachments */}
    <Section id="attachments" title="Attachments">
      <Endpoint
        method="GET"
        path="/v1/accounts/:accountId/messages/:messageId/attachments/:attachmentId"
        description="Get a signed download URL for an attachment. The URL is valid for 1 hour."
      >
        <p class="text-xs text-slate-500 mb-2">Response</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "url": "https://storage.googleapis.com/...",
    "filename": "photo.jpg",
    "contentType": "image/jpeg",
    "expiresAt": 1709140600000
  }
}`}
        />
      </Endpoint>
    </Section>

    {/* Webhooks */}
    <Section id="webhooks" title="Webhooks">
      <div class="text-slate-400 text-sm mb-6">
        <p>
          Register a webhook URL to get notified when your account receives
          email. We'll POST to your URL within seconds of delivery.
        </p>
      </div>

      <Endpoint
        method="POST"
        path="/v1/accounts/:accountId/webhooks"
        description="Register a webhook for inbound email notifications."
      >
        <p class="text-xs text-slate-500 mb-2">Request body</p>
        <CodeBlock
          lang="json"
          code={`{
  "url": "https://my-agent.example.com/inbox"
}`}
        />
        <p class="text-xs text-slate-500 mt-4 mb-2">Response (201)</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "id": "wh_789",
    "url": "https://my-agent.example.com/inbox",
    "secret": "whsec_abc123...",
    "active": true,
    "createdAt": 1709136000000
  }
}`}
        />
        <p class="text-slate-500 text-xs mt-2">
          Save the <code class="text-white">secret</code> -- it's only returned
          on creation. Use it to verify webhook signatures.
        </p>
      </Endpoint>

      <Endpoint
        method="GET"
        path="/v1/accounts/:accountId/webhooks"
        description="List all webhooks for this account."
      />

      <Endpoint
        method="DELETE"
        path="/v1/accounts/:accountId/webhooks/:webhookId"
        description="Delete a webhook."
      />

      <div class="mt-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h4 class="text-white font-medium mb-3">Webhook delivery format</h4>
        <p class="text-slate-400 text-sm mb-3">
          When an email arrives, we POST a JSON payload to your webhook URL:
        </p>
        <CodeBlock
          lang="json"
          code={`{
  "messageId": "msg_123",
  "accountId": "abc123",
  "from": "sender@gmail.com",
  "to": ["my-agent@theagentmail.net"],
  "subject": "Hello",
  "text": "Message body...",
  "html": "<p>Message body...</p>",
  "timestamp": 1709137000000
}`}
        />
      </div>

      <div class="mt-6 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
        <h4 class="text-white font-medium mb-3">Signature verification</h4>
        <p class="text-slate-400 text-sm mb-3">
          Every webhook delivery includes an{" "}
          <code class="text-white">X-Webhook-Signature</code> header. Verify it
          using HMAC-SHA256 with your webhook secret:
        </p>
        <CodeBlock
          lang="typescript"
          code={`import { createHmac } from "crypto";

const verify = (body: string, signature: string, secret: string) => {
  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return signature === expected;
};`}
        />
      </div>
    </Section>

    {/* Karma */}
    <Section id="karma" title="Karma">
      <div class="text-slate-400 text-sm space-y-3 mb-6">
        <p>
          Karma is a credit system that keeps the shared domain clean. Sending
          costs karma. Receiving from real people earns it back. Agents that
          have genuine conversations sustain themselves. Spammers run out and
          get blocked.
        </p>
        <p>
          You start with {INITIAL_KARMA} karma when you pay. That's{" "}
          {INITIAL_KARMA} sends, or{" "}
          {Math.floor(INITIAL_KARMA / Math.abs(KARMA_AMOUNTS.account_created))}{" "}
          accounts, or some mix.
        </p>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
        <div class="space-y-3">
          {(
            [
              ["money_paid", "Purchase karma credits"],
              [
                "email_received",
                "Reply from a trusted domain (once per sender until you reply back)",
              ],
              [
                "account_deleted",
                "Delete an email account (partial refund)",
              ],
              ["email_sent", "Send an email"],
              ["account_created", "Create a new email account"],
            ] as const
          ).map(([type, desc]) => {
            const amount = KARMA_AMOUNTS[type];
            return (
              <div
                key={type}
                class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
              >
                <div>
                  <span class="text-white font-mono text-sm">{type}</span>
                  <p class="text-slate-400 text-xs mt-0.5">{desc}</p>
                </div>
                <span
                  class={`font-mono font-bold text-sm ${amount > 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {formatKarma(amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div class="text-slate-400 text-sm space-y-3">
        <h4 class="text-white font-medium">Trusted domains</h4>
        <p>
          Karma for <code class="text-white">email_received</code> is only
          awarded when the sender uses a trusted email provider: Gmail,
          Outlook, Yahoo, iCloud, ProtonMail, Fastmail, Hey, and similar
          personal email services. Emails from throwaway or bulk domains don't
          earn karma.
        </p>
        <h4 class="text-white font-medium mt-4">Anti-gaming</h4>
        <p>
          You only earn karma once per sender until your agent replies back. If
          someone sends you 10 emails without you replying, you get{" "}
          {formatKarma(KARMA_AMOUNTS.email_received)} karma total, not{" "}
          {KARMA_AMOUNTS.email_received * 10}.
        </p>
      </div>

      <Endpoint
        method="GET"
        path="/v1/karma"
        description="Get your organization's karma balance and event history."
      >
        <p class="text-xs text-slate-500 mb-2">Response</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "balance": 87,
    "events": [
      {
        "id": "evt_1",
        "type": "money_paid",
        "amount": ${KARMA_AMOUNTS.money_paid},
        "timestamp": 1709136000000
      },
      {
        "id": "evt_2",
        "type": "account_created",
        "amount": ${KARMA_AMOUNTS.account_created},
        "timestamp": 1709136100000
      }
    ]
  }
}`}
        />
      </Endpoint>
    </Section>

    {/* Organizations */}
    <Section id="organizations" title="Organizations">
      <div class="text-slate-400 text-sm space-y-3 mb-6">
        <p>
          Each organization has one billing user (the creator) and can have
          additional admins. Karma and accounts belong to the organization, not
          individual users.
        </p>
        <p>
          Organizations are managed from the dashboard. By default, each user
          can create one organization. Contact{" "}
          <a
            href="mailto:support@theagentmail.net"
            class="text-blue-400 hover:text-blue-300"
          >
            support@theagentmail.net
          </a>{" "}
          to create additional organizations.
        </p>
      </div>

      <h4 class="text-white font-medium mb-3">Account API keys</h4>
      <Endpoint
        method="POST"
        path="/v1/accounts/:accountId/api-keys"
        description="Create a token scoped to a single account. Useful for giving an agent access to only its own mailbox without exposing org-level access."
      >
        <p class="text-xs text-slate-500 mb-2">Request body</p>
        <CodeBlock
          lang="json"
          code={`{
  "name": "My agent's key"  // optional
}`}
        />
        <p class="text-xs text-slate-500 mt-4 mb-2">Response (201)</p>
        <CodeBlock
          lang="json"
          code={`{
  "data": {
    "id": "key_123",
    "key": "am_abc123...",
    "prefix": "am_abc1",
    "name": "My agent's key",
    "createdAt": 1709136000000
  }
}`}
        />
        <p class="text-slate-500 text-xs mt-2">
          The full key is only returned once. Store it securely.
        </p>
      </Endpoint>
    </Section>

    {/* Errors */}
    <Section id="errors" title="Errors">
      <div class="text-slate-400 text-sm mb-4">
        <p>All errors return a JSON object with an error message and code:</p>
      </div>
      <CodeBlock
        lang="json"
        code={`{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}`}
      />
      <div class="mt-6 space-y-2">
        {[
          ["401", "UNAUTHORIZED", "Missing or invalid API key / token"],
          [
            "402",
            "KARMA_LOW",
            "Insufficient karma for this action",
          ],
          [
            "403",
            "FORBIDDEN",
            "Account-scoped token accessing org-level endpoint",
          ],
          ["404", "NOT_FOUND", "Resource not found"],
          ["409", "CONFLICT", "Address already taken"],
          ["500", "INTERNAL_ERROR", "Something went wrong on our end"],
        ].map(([status, code, desc]) => (
          <div
            key={code}
            class="flex items-start gap-3 py-2 px-3 bg-slate-800/30 rounded"
          >
            <span class="text-yellow-400 font-mono text-sm w-8 shrink-0">
              {status}
            </span>
            <code class="text-white text-sm w-36 shrink-0">{code}</code>
            <span class="text-slate-400 text-sm">{desc}</span>
          </div>
        ))}
      </div>
    </Section>

    {/* SDK */}
    <Section id="sdk" title="TypeScript SDK">
      <div class="text-slate-400 text-sm mb-4">
        <p>
          If you prefer typed method calls over raw HTTP, use the TypeScript
          SDK.
        </p>
      </div>
      <CodeBlock
        lang="typescript"
        code={`import { createClient } from "@agentmail/sdk";

const mail = createClient({ apiKey: "am_..." });

// Create an email account
const account = await mail.accounts.create({
  address: "my-agent@theagentmail.net",
});

// Send an email
await mail.messages.send(account.id, {
  to: ["human@example.com"],
  subject: "Hello from my agent",
  text: "This email was sent by an AI agent.",
});

// Check inbox
const messages = await mail.messages.list(account.id);

// Check karma balance
const karma = await mail.karma.getBalance();`}
      />
    </Section>

    {/* OpenCode skill */}
    <Section id="opencode" title="OpenCode skill">
      <div class="text-slate-400 text-sm space-y-3">
        <p>
          If your agent runs on{" "}
          <a
            href="https://opencode.ai"
            class="text-blue-400 hover:text-blue-300"
          >
            OpenCode
          </a>
          , install the AgentMail skill and it learns the full API
          automatically. No SDK needed.
        </p>
      </div>
      <div class="mt-4">
        <CodeBlock code={`opencode skill install agentmail`} />
      </div>
    </Section>
  </div>
);

export { Docs };
