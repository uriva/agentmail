import { useAuth } from "./db.ts";

const cloneSteps = `git clone https://github.com/uriva/agentmail.git
cd agentmail
cp .env.example .env

# Typecheck & run all tests
deno task check && deno task test

# Run locally
deno task dev        # API on :8000
deno task dev:web    # UI on :3000

# Deploy to your own Cloudflare Workers account
deno task build:web
deno task deploy`;

export const SelfHost = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div class="max-w-3xl mx-auto py-6">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
        Self-Host Guide · MIT License
      </p>
      <h1 class="display-serif text-4xl sm:text-5xl text-white mb-4">
        Self-host open-source email for AI agents.
      </h1>
      <p class="text-slate-400 text-lg leading-relaxed mb-8">
        Every piece of AgentMail — the Cloudflare Worker API, Durable Object
        rate/lock guards, remote MCP server, real-time AI spam filter, and
        Preact dashboard — is 100% open source under the MIT license.
      </p>

      <div class="grid sm:grid-cols-2 gap-4 mb-8">
        {[
          ["Runtime", "Cloudflare Workers + Durable Objects (Deno for local dev)"],
          ["Email transport", "Resend outbound API + Svix-signed inbound webhook"],
          ["Database", "InstantDB with strict read-only client permissions"],
          ["Abuse guard", "Real-time Gemini spam/phishing classifier + SSRF checks"],
        ].map(([k, v]) => (
          <div
            key={k}
            class="rounded-xl border border-slate-700 bg-slate-900/60 p-4"
          >
            <p class="font-mono text-xs text-blue-400 uppercase mb-1">{k}</p>
            <p class="text-slate-300 text-sm">{v}</p>
          </div>
        ))}
      </div>

      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-8">
        <h2 class="text-lg font-semibold text-white mb-3">
          Deploy on your own domain
        </h2>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono mb-4">
          <code>{cloneSteps}</code>
        </pre>
        <p class="text-slate-400 text-sm leading-relaxed">
          Set <code class="text-white">EMAIL_DOMAIN</code> in{" "}
          <code class="text-white">.env</code> and point your Resend inbound
          webhook to <code class="text-white">POST /inbound</code>. Full
          environment variable list is in{" "}
          <a
            href="https://github.com/uriva/agentmail#self-hosting-setup"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300"
          >
            README.md
          </a>
          .
        </p>
      </div>

      <div class="rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-white font-semibold mb-1">
            Want to skip DNS, Resend &amp; warmup ops?
          </h2>
          <p class="text-slate-400 text-sm">
            Use hosted <span class="font-mono text-slate-200">@theagentmail.net</span>{" "}
            — 1 mailbox free for 30 days, then $1/mo flat.
          </p>
        </div>
        <a
          href={ctaHref}
          class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 text-center"
        >
          Start free →
        </a>
      </div>
    </div>
  );
};
