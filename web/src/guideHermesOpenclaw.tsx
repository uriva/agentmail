import { useAuth } from "./db.ts";

const hermesYaml = `# ~/.hermes/config.yaml
mcp_servers:
  agentmail:
    url: https://api.theagentmail.net/mcp
    headers:
      Authorization: "Bearer \${AGENTMAIL_KEY}"`;

const skillsInstall = `# Install the AgentSkill in Hermes Agent, OpenClaw, Claude Code, or Cursor
npx skills add uriva/agentmail --skill theagentmail`;

const hermesWellKnown = `# Or install directly from theagentmail.net well-known skills endpoint
hermes skills install https://theagentmail.net`;

export const GuideHermesOpenclaw = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div class="max-w-3xl mx-auto py-6">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
        Hermes Agent &amp; OpenClaw Guide
      </p>
      <h1 class="display-serif text-4xl sm:text-5xl text-white mb-4">
        Give Hermes Agent or OpenClaw a real email inbox.
      </h1>
      <p class="text-slate-400 text-lg leading-relaxed mb-8">
        Connect your persistent personal agent to a dedicated{" "}
        <span class="font-mono text-slate-200">@theagentmail.net</span>{" "}
        mailbox over Streamable HTTP MCP or our standard AgentSkill. Scoped
        per-mailbox keys, real-time AI spam filtering, $1/month flat, 100% MIT
        open source.
      </p>

      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-8 space-y-5">
        <div>
          <h2 class="text-lg font-semibold text-white mb-2">
            1. Mint an account-scoped API key
          </h2>
          <p class="text-slate-400 text-sm">
            Create your free 30-day inbox at{" "}
            <a href={ctaHref} class="text-blue-400 hover:text-blue-300">
              theagentmail.net/app
            </a>
            , click <span class="text-white font-medium">API Key</span> on that
            mailbox, and export it as{" "}
            <code class="text-white">AGENTMAIL_KEY</code>. Account-scoped keys
            can only read and send from that one mailbox.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-white mb-2">
            2. Hermes Agent: native remote MCP (recommended)
          </h2>
          <p class="text-slate-400 text-sm mb-3">
            Hermes Agent has a built-in Streamable HTTP MCP client. Add six
            lines to <code class="text-white">~/.hermes/config.yaml</code> and
            your agent gets <code class="text-white">get_mailbox</code>,{" "}
            <code class="text-white">list_messages</code>,{" "}
            <code class="text-white">get_message</code>,{" "}
            <code class="text-white">send_email</code>, attachment URLs, and
            webhook tools automatically:
          </p>
          <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
            <code>{hermesYaml}</code>
          </pre>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-white mb-2">
            3. OpenClaw / Hermes / Claude Code: install the AgentSkill
          </h2>
          <p class="text-slate-400 text-sm mb-3">
            Prefer skill-driven HTTP calls or webhooks? Install the{" "}
            <code class="text-white">theagentmail</code> skill from GitHub or
            our well-known endpoint:
          </p>
          <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono mb-3">
            <code>{skillsInstall}</code>
          </pre>
          <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
            <code>{hermesWellKnown}</code>
          </pre>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 mb-8">
        <h2 class="text-lg font-semibold text-white mb-2">
          Built for persistent autonomous agents
        </h2>
        <ul class="text-slate-300 text-sm space-y-2 list-disc list-inside">
          <li>
            Exact reply threading (<code class="text-white">inReplyTo</code> +{" "}
            <code class="text-white">references</code>) so Gmail and Outlook
            keep conversations in one thread.
          </li>
          <li>
            HMAC-SHA256 signed <code class="text-white">email.received</code>{" "}
            webhooks for event-driven agent wakes without IMAP polling.
          </li>
          <li>
            $1/month per active mailbox ($5 prepaid balance never expires) vs
            $200/mo platform tiers. Full OTP/verification delivery unlocks with
            your first $5 deposit.
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-3">
        <a
          href={ctaHref}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Create a free inbox →
        </a>
        <a
          href="/guides/mcp"
          class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-200 rounded-lg transition-colors"
        >
          Remote MCP guide
        </a>
        <a
          href="https://github.com/uriva/agentmail"
          target="_blank"
          rel="noopener noreferrer"
          class="px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 font-mono text-sm rounded-lg transition-colors"
        >
          MIT source on GitHub
        </a>
      </div>
    </div>
  );
};
