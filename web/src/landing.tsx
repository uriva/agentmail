import { useRef, useEffect } from "preact/hooks";

const Section = ({
  children,
  class: className = "",
}: {
  children: preact.ComponentChildren;
  class?: string;
}) => <section class={`py-16 px-4 ${className}`}>{children}</section>;

const CodeBlock = ({ code, lang = "bash" }: { code: string; lang?: string }) => {
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
      <code ref={ref} class={`language-${lang}`}>{code}</code>
    </pre>
  );
};

const KarmaRow = ({
  event,
  amount,
  description,
}: {
  event: string;
  amount: string;
  description: string;
}) => (
  <div class="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
    <div>
      <span class="text-white font-mono text-sm">{event}</span>
      <p class="text-slate-400 text-xs mt-0.5">{description}</p>
    </div>
    <span
      class={`font-mono font-bold text-sm ${amount.startsWith("+") ? "text-green-400" : "text-red-400"}`}
    >
      {amount}
    </span>
  </div>
);

const Landing = () => (
  <div>
    {/* Hero */}
    <Section class="pt-24 pb-12 text-center">
      <h1 class="text-5xl sm:text-6xl font-extrabold text-white tracking-tight mb-6">
        Email for AI agents
      </h1>
      <p class="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
        Your agents need email. To sign up for GitHub, to receive verification
        codes, to communicate with people on their own behalf. You don't want
        to give them yours. You don't want to buy a domain for each one.
      </p>
      <p class="text-lg text-slate-400 max-w-xl mx-auto mb-10">
        AgentMail gives every agent its own{" "}
        <span class="text-white font-mono">@theagentmail.net</span> address.
        Not for newsletters or mass email. For agents that act as individuals
        in the world, and need a real mailbox to do it.
      </p>
      <div class="flex gap-4 justify-center flex-wrap">
        <a
          href="/login"
          class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Get started
        </a>
        <a
          href="#docs"
          class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-medium rounded-lg transition-colors"
        >
          API docs
        </a>
      </div>
    </Section>

    {/* The problem */}
    <Section>
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl font-bold text-white mb-6 text-center">
          The problem
        </h2>
        <div class="text-slate-400 leading-relaxed space-y-4 text-center max-w-2xl mx-auto">
          <p>
            AI agents are becoming actors in the world. They sign up for
            services, file issues, book meetings, respond to customers. They
            operate as individuals, not as broadcast channels. And most of what
            they do requires email.
          </p>
          <p>
            Your options today are bad. Give the agent your personal email and
            lose control of your inbox. Buy a domain per agent and deal with
            DNS, DKIM, SPF, deliverability. Use a disposable email service and
            get blocked by every provider that checks reputation.
          </p>
          <p class="text-slate-300">
            AgentMail is a shared domain with reputation management built in.
            One API call to create an address. Karma keeps the domain clean.
            Your agent gets a real, trusted mailbox it can use as its own.
          </p>
        </div>
      </div>
    </Section>

    {/* API first */}
    <Section>
      <div class="max-w-3xl mx-auto" id="docs">
        <h2 class="text-3xl font-bold text-white mb-4 text-center">
          API first
        </h2>
        <p class="text-slate-400 text-center mb-10 max-w-xl mx-auto">
          Built for agents, not humans clicking buttons. Create accounts,
          send email, poll inboxes, set up webhooks. All via REST or the
          TypeScript SDK.
        </p>
        <div class="space-y-8">
          <div>
            <h3 class="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2">
              Install the skill
            </h3>
            <p class="text-slate-400 text-sm mb-3">
              If your agent runs on OpenCode, install the AgentMail skill and it
              learns the full API automatically.
            </p>
            <CodeBlock code={`opencode skill install agentmail`} />
          </div>
          <div>
            <h3 class="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2">
              Create an account
            </h3>
            <CodeBlock
              code={`curl -X POST https://api.theagentmail.net/v1/accounts \\
  -H "Authorization: Bearer am_..." \\
  -H "Content-Type: application/json" \\
  -d '{"address": "my-agent@theagentmail.net"}'`}
            />
          </div>
          <div>
            <h3 class="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2">
              Send email
            </h3>
            <CodeBlock
              code={`curl -X POST https://api.theagentmail.net/v1/accounts/{id}/messages \\
  -H "Authorization: Bearer am_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": ["human@example.com"],
    "subject": "Hello from my agent",
    "text": "This email was sent by an AI agent."
  }'`}
            />
          </div>
          <div>
            <h3 class="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2">
              Read inbox
            </h3>
            <CodeBlock
              code={`curl https://api.theagentmail.net/v1/accounts/{id}/messages \\
  -H "Authorization: Bearer am_..."`}
            />
          </div>
          <div>
            <h3 class="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2">
              Get notified via webhook
            </h3>
            <CodeBlock
              code={`curl -X POST https://api.theagentmail.net/v1/accounts/{id}/webhooks \\
  -H "Authorization: Bearer am_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://my-agent.example.com/inbox"}'`}
            />
          </div>
        </div>
      </div>
    </Section>

    {/* TypeScript SDK */}
    <Section>
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl font-bold text-white mb-4 text-center">
          TypeScript SDK
        </h2>
        <p class="text-slate-400 text-center mb-10 max-w-xl mx-auto">
          Or use the SDK if you prefer typed method calls over raw HTTP.
        </p>
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
      </div>
    </Section>

    {/* Karma */}
    <Section>
      <div class="max-w-2xl mx-auto">
        <h2 class="text-3xl font-bold text-white mb-4 text-center">
          Karma solves spam
        </h2>
        <p class="text-slate-400 text-center mb-4 max-w-xl mx-auto">
          Everyone shares one domain. If someone uses it for mass email, the
          domain reputation tanks and everyone's mail lands in junk. So we need
          a way to prevent that without manually reviewing every message.
        </p>
        <p class="text-slate-400 text-center mb-4 max-w-xl mx-auto">
          Karma is a simple credit system. Sending costs karma. Receiving earns
          it back. An agent that sends emails people actually reply to sustains
          itself. One that blasts into the void runs out and gets blocked.
          This naturally selects for agents that behave like real people
          having real conversations, not like marketing tools.
        </p>
        <p class="text-slate-400 text-center mb-4 max-w-xl mx-auto">
          Karma is only awarded for replies from trusted email providers
          (Gmail, Outlook, Yahoo, iCloud, ProtonMail, etc.). Emails from
          throwaway domains don't count. And you only earn karma once per
          sender until your agent replies back. No gaming the system by
          having someone send you 100 emails.
        </p>
        <p class="text-slate-400 text-center mb-8 max-w-xl mx-auto">
          You start with 100 karma when you pay. That's 100 sends, or 10
          accounts, or some mix. Delete an account and get the karma back.
          An agent with a healthy reply rate sustains itself indefinitely.
        </p>
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <KarmaRow
            event="money_paid"
            amount="+100"
            description="Purchase karma credits"
          />
          <KarmaRow
            event="email_received"
            amount="+2"
            description="Someone replies from a trusted domain (once per sender until you reply back)"
          />
          <KarmaRow
            event="account_deleted"
            amount="+10"
            description="Delete an email address (karma refunded)"
          />
          <KarmaRow
            event="email_sent"
            amount="-1"
            description="Your agent sends an email"
          />
          <KarmaRow
            event="account_created"
            amount="-10"
            description="Create a new email address"
          />
        </div>
        <p class="text-slate-500 text-center mt-6 text-sm max-w-xl mx-auto">
          When karma hits zero, sends and account creation are blocked until you
          buy more or earn it back through genuine conversations.
        </p>
      </div>
    </Section>

    {/* Full API reference */}
    <Section>
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl font-bold text-white mb-8 text-center">
          API reference
        </h2>
        <div class="space-y-3">
          <ApiEndpoint method="POST" path="/v1/accounts" description="Create an email account" cost="-10 karma" />
          <ApiEndpoint method="GET" path="/v1/accounts" description="List all accounts" />
          <ApiEndpoint method="GET" path="/v1/accounts/:id" description="Get account details" />
          <ApiEndpoint method="DELETE" path="/v1/accounts/:id" description="Delete an account" cost="+10 karma" />
          <ApiEndpoint method="POST" path="/v1/accounts/:id/messages" description="Send an email" cost="-1 karma" />
          <ApiEndpoint method="GET" path="/v1/accounts/:id/messages" description="List messages (inbox)" />
          <ApiEndpoint method="GET" path="/v1/accounts/:id/messages/:msgId" description="Get full message with body and attachments" />
          <ApiEndpoint method="GET" path="/v1/accounts/:id/messages/:msgId/attachments/:attId" description="Get attachment download URL" />
          <ApiEndpoint method="POST" path="/v1/accounts/:id/webhooks" description="Register inbound email webhook" />
          <ApiEndpoint method="GET" path="/v1/accounts/:id/webhooks" description="List webhooks" />
          <ApiEndpoint method="DELETE" path="/v1/accounts/:id/webhooks/:whId" description="Delete a webhook" />
          <ApiEndpoint method="GET" path="/v1/karma" description="Get karma balance and event history" />
        </div>
        <p class="text-slate-500 text-sm mt-6 text-center">
          All endpoints require <span class="font-mono text-slate-400">Authorization: Bearer am_...</span> header.
          Base URL: <span class="font-mono text-slate-400">https://api.theagentmail.net</span>
        </p>
      </div>
    </Section>

    {/* CTA */}
    <Section class="text-center pb-24">
      <h2 class="text-3xl font-bold text-white mb-4">
        Give your agent an email
      </h2>
      <p class="text-slate-400 mb-8">
        Sign up, get an API key, create an address. Takes about two minutes.
      </p>
      <a
        href="/login"
        class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-lg"
      >
        Get started
      </a>
    </Section>

    {/* Footer */}
    <footer class="border-t border-slate-800 py-8 px-4 text-center text-slate-500 text-sm">
      <p>AgentMail — email for AI agents</p>
      <p class="mt-2">
        Questions? <a href="mailto:support@theagentmail.net" class="text-slate-400 hover:text-white transition-colors">support@theagentmail.net</a>
      </p>
    </footer>
  </div>
);

const ApiEndpoint = ({
  method,
  path,
  description,
  cost,
}: {
  method: string;
  path: string;
  description: string;
  cost?: string;
}) => {
  const methodColor =
    method === "GET"
      ? "text-green-400 bg-green-400/10"
      : method === "POST"
        ? "text-blue-400 bg-blue-400/10"
        : "text-red-400 bg-red-400/10";
  return (
    <div class="flex items-start sm:items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/50 transition-colors flex-col sm:flex-row">
      <span class={`font-mono text-xs font-bold px-2 py-0.5 rounded ${methodColor} shrink-0 w-16 text-center`}>
        {method}
      </span>
      <span class="font-mono text-sm text-slate-300 shrink-0">{path}</span>
      <span class="text-slate-500 text-sm flex-1">{description}</span>
      {cost && (
        <span class="text-red-400/70 text-xs font-mono shrink-0">{cost}</span>
      )}
    </div>
  );
};

export { Landing };
