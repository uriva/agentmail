import { useAuth } from "./db.ts";

const mcpSnippet = `claude mcp add --transport http agentmail https://api.theagentmail.net/mcp \\
  --header "Authorization: Bearer am_..."`;

const webhookGuardSnippet = `def _require_webhook_approval(tool_name="", args=None, **kwargs):
    if tool_name != "theagentmail_create_webhook":
        return None
    target = (args or {}).get("url", "<missing url>")
    return {
        "action": "approve",
        "message": f"Register persistent AgentMail webhook to {target}?",
    }`;

export const BlogSharedDomain = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <article class="max-w-3xl mx-auto py-6 text-slate-300 leading-relaxed">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
        Engineering Notes · Nov 2026
      </p>
      <h1 class="display-serif text-4xl sm:text-5xl text-white mb-5 leading-tight">
        What actually happens when you run a shared email domain for AI agents
      </h1>
      <p class="text-slate-400 text-lg mb-8">
        Giving an AI agent an email address looks simple on paper. Spin up an
        SMTP relay, hook up an inbound webhook, hand the agent an API key, done.
        In practice, the plumbing takes an afternoon. Keeping the domain from
        getting blacklisted takes most of the real engineering.
      </p>

      <div class="space-y-6 text-base">
        <p>
          Most builders hit the same three bad options first:
        </p>
        <ul class="list-disc pl-6 space-y-2 text-slate-300">
          <li>
            <strong class="text-white">Give the agent your personal Gmail.</strong>{" "}
            Now a prompt injection or a stray tool call has access to your
            password resets, billing, and identity.
          </li>
          <li>
            <strong class="text-white">Buy a fresh domain per agent.</strong>{" "}
            Now you are managing DNS, SPF, DKIM, and cold-start warmup every
            time you spin up a new worker.
          </li>
          <li>
            <strong class="text-white">Use a disposable burner service.</strong>{" "}
            Almost every service that matters (GitHub, Linear, Slack, Stripe)
            already blocklists burner domains, so OTPs never arrive.
          </li>
        </ul>

        <p>
          A shared domain with managed reputation solves this for developers,
          because one API call gives an agent a working address with zero DNS
          setup. The catch is that the moment your shared domain has decent
          deliverability, spammers and burner-account farmers show up
          immediately.
        </p>

        <h2 class="text-2xl font-bold text-white pt-4">
          The two abuse vectors that show up fast
        </h2>
        <p>
          Running{" "}
          <a href="/" class="text-blue-400 hover:text-blue-300 underline">
            theagentmail.net
          </a>{" "}
          (MIT open-source email infrastructure on Cloudflare Workers) surfaced
          two distinct abuse patterns right away:
        </p>
        <ol class="list-decimal pl-6 space-y-3 text-slate-300">
          <li>
            <strong class="text-white">
              Outbound phishing and unsolicited cold blasts.
            </strong>{" "}
            Someone creates a free trial account, names the org something
            generic, and immediately tries to blast cold outreach or phishing
            templates impersonating Meta or SaaS login alerts. If even a handful
            of those leave the server, spam complaints tank inbox placement for
            every legitimate agent on the domain.
          </li>
          <li>
            <strong class="text-white">Free burner OTP farming.</strong>{" "}
            Automated scripts sign up for free trials just to receive signup and
            verification codes for other platforms, burning through addresses
            with zero intention of paying.
          </li>
        </ol>

        <h2 class="text-2xl font-bold text-white pt-4">
          Four layers that actually stop it without breaking legit agents
        </h2>
        <p>
          Rate limits alone do not work, because ten phishing emails are enough
          to hurt domain reputation. Static keyword lists help for obvious
          templates, but spammers rephrase constantly. The setup that has held
          up in production layers four checks synchronously in the request path:
        </p>

        <div class="space-y-4">
          <div class="rounded-xl border border-slate-700/80 bg-slate-900/60 p-5">
            <h3 class="text-white font-semibold mb-1">
              1. Phone verification on free trials
            </h3>
            <p class="text-sm text-slate-400">
              One-time SMS verification raises the floor so spinning up 50
              throwaway orgs is not free. Phone numbers are canonicalized and
              checked atomically inside a Durable Object lock so concurrent
              requests cannot race trial creation.
            </p>
          </div>

          <div class="rounded-xl border border-slate-700/80 bg-slate-900/60 p-5">
            <h3 class="text-white font-semibold mb-1">
              2. Redacting inbound OTP and signup emails on free trials
            </h3>
            <p class="text-sm text-slate-400">
              Free trials still get full normal send, receive, and webhooks so
              builders can test their agent end-to-end. Inbound signup, OTP, and
              account-activation emails are redacted on free trials and unlock
              automatically as soon as an org adds a $5 prepaid deposit (which
              covers 5 mailbox-months at $1/mo and never expires). That single
              rule killed burner farming overnight without hurting real trials.
            </p>
          </div>

          <div class="rounded-xl border border-slate-700/80 bg-slate-900/60 p-5">
            <h3 class="text-white font-semibold mb-1">
              3. Synchronous AI outbound spam and phishing guard
            </h3>
            <p class="text-sm text-slate-400">
              Every outbound email passes through{" "}
              <a
                href="https://github.com/uriva/agentmail/blob/main/src/services/emailGuard.ts"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-blue-400 hover:text-blue-300 underline"
              >
                src/services/emailGuard.ts
              </a>{" "}
              before it ever touches Resend. Both the plain-text and HTML bodies
              are inspected so hiding phishing text in one MIME part does not
              slip past. Legitimate 1:1 agent mail, deploy alerts, and human
              handoffs pass right through. Phishing, credential harvesting, and
              mass cold spam fail synchronously with{" "}
              <code class="text-slate-200">400 SPAM_REJECTED</code>.
            </p>
          </div>

          <div class="rounded-xl border border-slate-700/80 bg-slate-900/60 p-5">
            <h3 class="text-white font-semibold mb-1">
              4. Durable Object locks, replay dedup, and strict webhook SSRF guards
            </h3>
            <p class="text-sm text-slate-400">
              Because outbound sends, quota accounting, and frozen-state checks
              run synchronously inside Cloudflare Durable Object locks, freezing
              a bad tenant takes effect immediately with zero queued backlog
              leaking out after a restart. Inbound webhooks verify Svix
              signatures with replay deduplication, and outbound customer
              webhooks use <code class="text-slate-200">redirect: "manual"</code>{" "}
              to block 3xx redirect SSRF chains.
            </p>
          </div>
        </div>

        <h2 class="text-2xl font-bold text-white pt-4">
          The prompt-injection trap most agent email setups miss
        </h2>
        <p>
          Inbound email is untrusted text that gets fed straight into an LLM
          context window. Two things follow directly from that:
        </p>
        <p>
          First, <strong class="text-white">keys have to be scoped to one mailbox</strong>.
          Giving an agent an org-level admin key lets a prompt injection list
          neighboring mailboxes, mint keys, or inspect billing. An account-scoped
          key (<code class="text-slate-200">am_...</code>) only sees its own
          single inbox.
        </p>
        <p>
          Second, <strong class="text-white">watch out for persistent inbox forwarding</strong>.
          During security review for our Hermes Agent plugin, a reviewer pointed
          out a subtle attack: a prompt-injected email could instruct the agent
          to call <code class="text-slate-200">create_webhook</code> pointing at
          an attacker URL, silently exfiltrating every future email even after
          the session ends. Gating webhook creation behind an explicit human
          approval prompt showing the destination URL closes that hole cleanly:
        </p>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{webhookGuardSnippet}</code>
        </pre>

        <h2 class="text-2xl font-bold text-white pt-4">
          Zero-friction integration for coding agents
        </h2>
        <p>
          The other thing we noticed watching people wire email into Claude Code,
          Hermes Agent, OpenClaw, and Cursor is that nobody wants to install a
          bloated wrapper SDK or maintain a local stdio bridge just to read an
          inbox.
        </p>
        <p>
          We put a native Streamable HTTP remote MCP endpoint straight inside
          the Cloudflare Worker at{" "}
          <code class="text-slate-200">https://api.theagentmail.net/mcp</code>{" "}
          (published in the official MCP Registry as{" "}
          <code class="text-slate-200">net.theagentmail/agentmail</code>):
        </p>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{mcpSnippet}</code>
        </pre>
        <p>
          If you prefer plain HTTP, pointing any coding agent at{" "}
          <a
            href="https://theagentmail.net/llms.txt"
            class="text-blue-400 hover:text-blue-300 underline"
          >
            theagentmail.net/llms.txt
          </a>{" "}
          gives it the entire REST and MCP spec in one fetch.
        </p>

        <p>
          The entire stack (Cloudflare Workers, Durable Object guards, Resend,
          InstantDB, AI spam guard, remote MCP server, and Preact UI) is MIT
          open source. If you want to audit the code, fork the spam guard, or
          self-host it on your own domain, everything is in the repo.
        </p>
      </div>

      <div class="mt-10 pt-8 border-t border-slate-800 flex flex-wrap gap-3">
        <a
          href="https://github.com/uriva/agentmail"
          target="_blank"
          rel="noopener noreferrer"
          class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Read the source on GitHub
        </a>
        <a
          href={ctaHref}
          class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try a free 30-day inbox →
        </a>
        <a
          href="/self-host"
          class="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 text-sm rounded-lg transition-colors"
        >
          Self-host guide
        </a>
        <a
          href="/compare"
          class="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-300 text-sm rounded-lg transition-colors"
        >
          Compare vs agentmail.to
        </a>
      </div>
    </article>
  );
};
