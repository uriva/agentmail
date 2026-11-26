import { useAuth } from "./db.ts";

const claudeCmd = `claude mcp add --transport http agentmail https://api.theagentmail.net/mcp \\
  --header "Authorization: Bearer am_..."`;

const jsonConfig = `{
  "mcpServers": {
    "agentmail": {
      "url": "https://api.theagentmail.net/mcp",
      "headers": {
        "Authorization": "Bearer am_..."
      }
    }
  }
}`;

const toolsList = [
  ["get_mailbox", "Account or Org", "Inspect mailbox address, status, expiration, and quota usage."],
  ["list_messages", "Account or Org", "List recent inbound and outbound messages, newest first."],
  ["get_message", "Account or Org", "Read full plain-text/HTML body, threading headers, and attachment metadata."],
  ["send_email", "Account or Org", "Send email with threading headers (scanned in real time for spam/phishing)."],
  ["get_attachment_url", "Account or Org", "Generate a 1-hour signed download URL for an attachment."],
  ["list_webhooks / create_webhook / delete_webhook", "Account or Org", "Manage real-time HMAC-signed email.received webhooks."],
  ["list_mailboxes / create_mailbox / get_balance", "Org key only", "Provision mailboxes and check prepaid balance."],
] as const;

export const GuideMcp = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div class="max-w-3xl mx-auto py-6">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
        MCP Integration Guide
      </p>
      <h1 class="display-serif text-4xl sm:text-5xl text-white mb-4">
        Remote MCP server for AI agent email.
      </h1>
      <p class="text-slate-400 text-lg leading-relaxed mb-8">
        Give Claude Code, Claude Desktop, Cursor, Windsurf, OpenCode, or
        OpenClaw a dedicated{" "}
        <span class="font-mono text-slate-200">@theagentmail.net</span>{" "}
        mailbox over Streamable HTTP MCP. No local bridge, no npm install, no
        DNS setup.
      </p>

      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-8 space-y-4">
        <h2 class="text-lg font-semibold text-white">
          1. Create an inbox &amp; scoped API key
        </h2>
        <p class="text-slate-400 text-sm">
          Sign in at{" "}
          <a href={ctaHref} class="text-blue-400 hover:text-blue-300">
            theagentmail.net/app
          </a>
          , claim your free 30-day mailbox, click{" "}
          <span class="text-white font-medium">API Key</span> on that mailbox,
          and generate an account-scoped key (<code class="text-white">am_...</code>).
        </p>
        <h2 class="text-lg font-semibold text-white pt-2">
          2. Connect Claude Code in one command
        </h2>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{claudeCmd}</code>
        </pre>
        <h2 class="text-lg font-semibold text-white pt-2">
          Or paste into Cursor / OpenCode / MCP JSON config
        </h2>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{jsonConfig}</code>
        </pre>
      </div>

      <div class="mb-10">
        <h2 class="text-2xl font-bold text-white mb-4">Available MCP tools</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-slate-700 bg-slate-800/60">
                <th class="p-3.5 text-slate-300 font-medium">Tool</th>
                <th class="p-3.5 text-slate-300 font-medium">Scope</th>
                <th class="p-3.5 text-slate-300 font-medium">Description</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              {toolsList.map(([name, scope, desc]) => (
                <tr key={name}>
                  <td class="p-3.5 font-mono text-xs text-blue-300">{name}</td>
                  <td class="p-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {scope}
                  </td>
                  <td class="p-3.5 text-slate-300 text-xs">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 mb-10">
        <h2 class="text-lg font-semibold text-white mb-2">
          Why scoped per-mailbox keys matter
        </h2>
        <p class="text-slate-400 text-sm leading-relaxed">
          Incoming emails are untrusted input. Passing an account-scoped token
          to the remote MCP server guarantees your agent can only read and send
          from its own single mailbox. It cannot list neighboring inboxes, read
          billing details, or touch your personal Gmail.
        </p>
      </div>

      <div class="flex flex-wrap gap-3">
        <a
          href={ctaHref}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Create a free inbox →
        </a>
        <a
          href="/docs#mcp"
          class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-200 rounded-lg transition-colors"
        >
          Full API &amp; MCP docs
        </a>
        <a
          href="https://github.com/uriva/agentmail/blob/main/src/handlers/mcp.ts"
          target="_blank"
          rel="noopener noreferrer"
          class="px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 font-mono text-sm rounded-lg transition-colors"
        >
          Read mcp.ts source
        </a>
      </div>
    </div>
  );
};
