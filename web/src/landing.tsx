import type { ComponentChildren } from "preact";
import { useAuth } from "./db.ts";
import { planDetails } from "../../src/planData.ts";

const githubUrl = "https://github.com/uriva/agentmail";

const Section = ({
  children,
  class: className = "",
  id,
}: {
  children: ComponentChildren;
  class?: string;
  id?: string;
}) => (
  <section id={id} class={`px-4 sm:px-6 ${className}`}>
    <div class="max-w-6xl mx-auto">{children}</div>
  </section>
);

const Eyebrow = ({ children }: { children: ComponentChildren }) => (
  <p class="font-mono text-[11px] uppercase tracking-[0.25em] text-lime-400/90 mb-5">
    {children}
  </p>
);

const TerminalDot = ({ color }: { color: string }) => (
  <span class={`w-2.5 h-2.5 rounded-full ${color}`} />
);

const CodeBlock = ({ code, lang }: { code: string; lang: string }) => (
  <pre class="overflow-x-auto text-[13px] leading-relaxed font-mono">
    <code class={`language-${lang} text-slate-200`}>{code}</code>
  </pre>
);

const curlExample = `curl -X POST https://api.theagentmail.net/v1/accounts \\
  -H "Authorization: Bearer am_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"address": "deploy-bot"}'

# → deploy-bot@theagentmail.net is live`;

const sdkExample = `import { AgentMail } from "@agentmail/sdk";

const mail = new AgentMail(process.env.AGENTMAIL_KEY!);

const inbox = await mail.accounts.create({ address: "deploy-bot" });
await mail.messages.send(inbox.id, {
  to: ["you@company.com"],
  subject: "Deploy succeeded",
  text: "All checks green.",
});`;

const webhookExample = `POST /your-webhook  event: email.received
{
  "from": "github@github.com",
  "subject": "Your verification code: 481516",
  "to": ["deploy-bot@theagentmail.net"]
}`;

const faqs = [
  {
    q: "How do I give my AI agent an email address?",
    a: "Create a mailbox with one API call and your agent gets a real address on @theagentmail.net. It can send via REST, receive via polling or webhooks, and handle attachments — no domains, DNS, or SPF/DKIM setup.",
  },
  {
    q: "Can agents receive verification codes and sign up for services?",
    a: "Yes — that's the core use case. Agents sign up for GitHub, Slack, Linear and friends, receive the OTP or magic link in their AgentMail inbox, and complete the flow themselves via API or webhook.",
  },
  {
    q: "Is AgentMail really open source?",
    a: "Completely. MIT licensed — backend, frontend, SDK, and infrastructure are all public on GitHub. Self-host it, audit every line that touches your agents' email, or send a PR.",
  },
  {
    q: "How much does it cost?",
    a: planDetails.faqCostAnswer,
  },
  {
    q: "How do you stop spam from ruining deliverability?",
    a: "Every outbound message is scanned in real time by JEV before it leaves the server. Phishing and cold-spam blasts are blocked instantly, so the shared domain stays trusted and legitimate agent mail lands in the inbox.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const Landing = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div class="landing-root">
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>

      <Section class="pt-14 pb-10">
        <div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-6">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-xs px-3 py-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 text-lime-300 hover:bg-lime-400/20 transition-colors"
              >
                ● 100% open source · MIT
              </a>
              <span class="font-mono text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300">
                {planDetails.trial.badgeText}
              </span>
              <span class="font-mono text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300">
                {planDetails.rental.badgeText}
              </span>
            </div>
            <h1 class="display-serif text-5xl sm:text-6xl lg:text-7xl leading-[0.95] text-amber-50 mb-6">
              Give every agent a{" "}
              <em class="not-italic text-lime-300">real inbox.</em>
            </h1>
            <p class="text-lg text-slate-300/90 max-w-xl mb-4 leading-relaxed">
              Your agents sign up for tools, receive OTPs, file issues, and
              talk to humans. They need email that acts like a person — not a
              newsletter pipe.
            </p>
            <p class="text-slate-400 max-w-xl mb-8">
              One API call. A real{" "}
              <span class="font-mono text-amber-100">
                @theagentmail.net
              </span>{" "}
              mailbox with sending, receiving, webhooks, and attachments. No
              domains. No DNS. No shared passwords.
            </p>
            <div class="flex flex-wrap gap-3 mb-8">
              <a
                href={ctaHref}
                class="px-6 py-3 bg-lime-300 hover:bg-lime-200 text-slate-950 font-semibold rounded-lg transition-colors"
              >
                Create an inbox →
              </a>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="px-6 py-3 border border-slate-600 hover:border-lime-300/60 hover:text-white text-slate-200 font-medium rounded-lg transition-colors font-mono text-sm flex items-center"
              >
                ★ Star on GitHub
              </a>
              <a
                href="/docs"
                class="px-6 py-3 text-slate-300 hover:text-white font-medium transition-colors font-mono text-sm flex items-center"
              >
                Read the docs
              </a>
            </div>
            <dl class="grid grid-cols-3 max-w-md gap-4 border-t border-slate-800 pt-5">
              {[
                ["$1/mo", "per mailbox"],
                ["1,000", "sends incl."],
                ["∞", "inbound free"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt class="sr-only">{l}</dt>
                  <dd class="font-mono text-2xl text-amber-50">{v}</dd>
                  <dd class="text-xs text-slate-500 mt-1">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div class="terminal-card rounded-2xl overflow-hidden">
            <div class="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
              <TerminalDot color="bg-red-400/80" />
              <TerminalDot color="bg-amber-300/80" />
              <TerminalDot color="bg-lime-300/80" />
              <span class="ml-3 font-mono text-xs text-slate-400">
                agent — zsh
              </span>
              <span class="ml-auto font-mono text-[11px] text-lime-300/80 border border-lime-300/20 rounded px-2 py-0.5">
                LIVE
              </span>
            </div>
            <div class="p-5">
              <CodeBlock code={curlExample} lang="bash" />
            </div>
            <div class="mx-5 mb-5 rounded-xl border border-white/10 bg-black/40 overflow-hidden">
              <div class="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                <span class="font-mono text-xs text-slate-300">
                  ✉ deploy-bot@theagentmail.net
                </span>
                <span class="font-mono text-[11px] text-lime-300">
                  ● new mail
                </span>
              </div>
              <div class="px-4 py-3 flex gap-3 items-start inbox-pulse">
                <div class="w-8 h-8 rounded-full bg-amber-200 text-slate-900 font-bold text-sm flex items-center justify-center shrink-0">
                  G
                </div>
                <div class="min-w-0">
                  <p class="text-sm text-slate-100 font-medium truncate">
                    GitHub — Your verification code: 481516
                  </p>
                  <p class="text-xs text-slate-400 mt-1">
                    Your agent reads the OTP via API and finishes signup
                    itself. No human in the loop.
                  </p>
                  <p class="font-mono text-[11px] text-slate-500 mt-2">
                    200 OK · webhook delivered in 0.4s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section class="py-8">
        <div class="marquee-wrap border-y border-slate-800 py-3 overflow-hidden">
          <p class="marquee font-mono text-xs uppercase tracking-[0.2em] text-slate-500 whitespace-nowrap">
            OTPs & verification codes&ensp;·&ensp;GitHub / Slack / Linear
            signups&ensp;·&ensp;support inboxes&ensp;·&ensp;deploy
            notifications&ensp;·&ensp;human handoffs&ensp;·&ensp;webhook
            pipelines&ensp;·&ensp;attachments&ensp;·&ensp;OTPs & verification
            codes&ensp;·&ensp;GitHub / Slack / Linear signups&ensp;·&ensp;support
            inboxes&ensp;·&ensp;deploy notifications&ensp;·&ensp;human
            handoffs&ensp;·&ensp;webhook pipelines&ensp;·&ensp;attachments
          </p>
        </div>
      </Section>

      <Section class="py-14">
        <Eyebrow>01 — How it works</Eyebrow>
        <h2 class="display-serif text-4xl sm:text-5xl text-amber-50 mb-4 max-w-2xl">
          Three calls. One working inbox.
        </h2>
        <p class="text-slate-400 max-w-xl mb-10">
          REST API or TypeScript SDK. Poll for mail or get pushed by webhooks.
        </p>
        <div class="grid md:grid-cols-3 gap-4">
          {[
            {
              n: "01",
              t: "Create the mailbox",
              d: "One POST. Your agent owns a real address instantly.",
              code: curlExample,
              lang: "bash",
            },
            {
              n: "02",
              t: "Send like a human",
              d: "Outbound scanned by JEV so the domain stays trusted.",
              code: sdkExample,
              lang: "typescript",
            },
            {
              n: "03",
              t: "Receive in realtime",
              d: "Webhooks fire the moment mail lands. OTPs included.",
              code: webhookExample,
              lang: "json",
            },
          ].map((c) => (
            <article
              key={c.n}
              class="rounded-2xl border border-slate-700/80 bg-slate-900/70 overflow-hidden flex flex-col"
            >
              <div class="p-5 pb-3">
                <p class="font-mono text-xs text-lime-300 mb-2">{c.n}</p>
                <h3 class="text-white font-semibold text-lg mb-1">{c.t}</h3>
                <p class="text-slate-400 text-sm">{c.d}</p>
              </div>
              <div class="m-3 mt-1 rounded-xl bg-black/50 border border-white/5 p-4 flex-1">
                <CodeBlock code={c.code} lang={c.lang} />
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section class="py-14">
        <div class="grid lg:grid-cols-2 gap-10 items-start rounded-3xl border border-lime-300/15 bg-gradient-to-b from-lime-300/[0.06] to-transparent p-8 sm:p-12">
          <div>
            <Eyebrow>02 — Why not DIY?</Eyebrow>
            <h2 class="display-serif text-4xl sm:text-5xl text-amber-50 mb-6">
              Disposable email gets blocked. Personal email gets hijacked.
            </h2>
            <ul class="space-y-4">
              {[
                ["Your inbox", "Hand an agent your Gmail and you've lost control of password resets, billing, and your identity."],
                ["A domain per agent", "DNS, SPF, DKIM, warmup, deliverability firefighting — times every agent you spin up."],
                ["Disposable services", "Burner domains are blocklisted everywhere that matters. OTPs never arrive."],
              ].map(([t, d]) => (
                <li key={t} class="flex gap-3">
                  <span class="font-mono text-red-300 mt-0.5">✕</span>
                  <p class="text-slate-300 text-sm leading-relaxed">
                    <strong class="text-white font-semibold">{t} — </strong>
                    {d}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div class="rounded-2xl border border-white/10 bg-black/50 p-6">
            <p class="font-mono text-xs text-lime-300 mb-3">
              ✓ THE AGENTMAIL WAY
            </p>
            <p class="text-slate-200 leading-relaxed mb-4">
              One shared domain with managed reputation. Every outbound message
              is evaluated in real time by JEV — phishing and spam blasts die
              before they leave the server.
            </p>
            <p class="text-slate-400 text-sm leading-relaxed mb-5">
              Legit agent traffic — signups, notifications, human conversation —
              sails through. Everyone's mail keeps landing in the inbox.
            </p>
            <div class="grid grid-cols-2 gap-3">
              {[
                ["99%+", "inbox rate*"],
                ["0.4s", "webhook p50"],
                ["1,000", "sends / mo"],
                ["MIT", "fully open"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  class="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center"
                >
                  <p class="font-mono text-xl text-amber-50">{v}</p>
                  <p class="text-[11px] text-slate-500 mt-1">{l}</p>
                </div>
              ))}
            </div>
            <p class="text-[11px] text-slate-600 mt-3">
              *Illustrative target for legitimate agent traffic, not a guarantee.
            </p>
          </div>
        </div>
      </Section>

      <Section class="py-14">
        <Eyebrow>03 — Pricing</Eyebrow>
        <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
          <h2 class="display-serif text-4xl sm:text-5xl text-amber-50">
            Honest pricing.
          </h2>
          <a
            href="/pricing"
            class="font-mono text-sm text-lime-300 hover:text-lime-200"
          >
            Full pricing →
          </a>
        </div>
        <div class="grid sm:grid-cols-3 gap-4">
          {[
            {
              t: planDetails.trial.title,
              p: planDetails.trial.priceDisplay,
              s: planDetails.trial.durationDisplay,
              d: planDetails.trial.summary,
              cta: "Start free",
              hot: false,
            },
            {
              t: planDetails.rental.title,
              p: planDetails.rental.priceDisplay,
              s: planDetails.rental.periodDisplay,
              d: planDetails.rental.summary,
              cta: "Get started",
              hot: true,
            },
            {
              t: planDetails.topup.title,
              p: planDetails.topup.priceDisplay,
              s: planDetails.topup.periodDisplay,
              d: planDetails.topup.summary,
              cta: "See how",
              hot: false,
            },
          ].map((c) => (
            <article
              key={c.t}
              class={`rounded-2xl border p-6 flex flex-col ${
                c.hot
                  ? "border-lime-300/40 bg-lime-300/[0.07]"
                  : "border-slate-700/80 bg-slate-900/70"
              }`}
            >
              <p class="font-mono text-xs uppercase tracking-widest text-slate-400">
                {c.t}
              </p>
              <p class="mt-2">
                <span class="font-mono text-4xl text-white">{c.p}</span>{" "}
                <span class="text-sm text-slate-400">{c.s}</span>
              </p>
              <p class="text-sm text-slate-400 mt-3 mb-6">{c.d}</p>
              <a
                href={c.hot ? ctaHref : "/pricing"}
                class={`mt-auto text-center px-5 py-2.5 rounded-lg font-medium transition-colors ${
                  c.hot
                    ? "bg-lime-300 hover:bg-lime-200 text-slate-950"
                    : "border border-slate-600 hover:border-slate-400 text-slate-200"
                }`}
              >
                {c.cta}
              </a>
            </article>
          ))}
        </div>
      </Section>

      <Section class="py-14">
        <div class="grid lg:grid-cols-2 gap-10 items-center rounded-3xl border border-slate-700/80 bg-slate-900/60 p-8 sm:p-12 overflow-hidden">
          <div>
            <Eyebrow>04 — Open source</Eyebrow>
            <h2 class="display-serif text-4xl sm:text-5xl text-amber-50 mb-4">
              No black boxes on your agents' email.
            </h2>
            <p class="text-slate-400 mb-6 max-w-md">
              Backend, frontend, SDK, infra — all MIT licensed and public.
              Self-host it, read every line, or contribute the feature you need.
            </p>
            <div class="flex flex-wrap gap-3">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="px-6 py-3 bg-amber-50 hover:bg-white text-slate-950 font-semibold rounded-lg transition-colors"
              >
                View source
              </a>
              <a
                href={`${githubUrl}/blob/main/README.md`}
                target="_blank"
                rel="noopener noreferrer"
                class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-200 rounded-lg transition-colors font-mono text-sm"
              >
                Self-host guide
              </a>
            </div>
          </div>
          <div class="rounded-2xl bg-black/60 border border-white/10 overflow-hidden">
            <div class="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
              <TerminalDot color="bg-red-400/80" />
              <TerminalDot color="bg-amber-300/80" />
              <TerminalDot color="bg-lime-300/80" />
              <span class="ml-3 font-mono text-xs text-slate-400">
                clone + run
              </span>
            </div>
            <div class="p-5">
              <CodeBlock
                code={`git clone https://github.com/uriva/agentmail.git
cd agentmail && cp .env.example .env
deno task dev        # API on :8000
deno task dev:web    # UI on :3000`}
                lang="bash"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section class="py-14" id="faq">
        <div class="grid lg:grid-cols-[0.9fr_1.1fr] gap-10">
          <div>
            <Eyebrow>05 — FAQ</Eyebrow>
            <h2 class="display-serif text-4xl sm:text-5xl text-amber-50 mb-4">
              Asked by agent builders.
            </h2>
            <p class="text-slate-400 max-w-sm">
              Still stuck?{" "}
              <a
                href="mailto:support@theagentmail.net"
                class="text-lime-300 hover:text-lime-200"
              >
                support@theagentmail.net
              </a>{" "}
              is a real inbox, read by humans.
            </p>
          </div>
          <div class="divide-y divide-slate-800 border-y border-slate-800">
            {faqs.map((f) => (
              <details key={f.q} class="group py-5">
                <summary class="cursor-pointer list-none flex justify-between gap-4 text-slate-100 font-medium">
                  {f.q}
                  <span class="font-mono text-lime-300 group-open:rotate-45 transition-transform shrink-0">
                    +
                  </span>
                </summary>
                <p class="text-slate-400 text-sm leading-relaxed mt-3 max-w-2xl">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      <Section class="pb-20 pt-6 text-center">
        <div class="rounded-3xl border border-lime-300/20 bg-gradient-to-b from-lime-300/10 to-transparent px-6 py-14">
          <p class="font-mono text-xs uppercase tracking-[0.25em] text-lime-300 mb-4">
            Takes ~2 minutes
          </p>
          <h2 class="display-serif text-4xl sm:text-6xl text-amber-50 mb-4">
            Ship the agent.
            <br />
            We'll hold its mail.
          </h2>
          <p class="text-slate-400 mb-8">
            Sign up, grab an API key, create an address. Free for 30 days.
          </p>
          <div class="flex gap-3 justify-center flex-wrap">
            <a
              href={ctaHref}
              class="px-8 py-3.5 bg-lime-300 hover:bg-lime-200 text-slate-950 font-semibold rounded-lg transition-colors text-lg"
            >
              Create an inbox →
            </a>
            <a
              href="/docs"
              class="px-8 py-3.5 border border-slate-600 hover:border-slate-400 text-slate-200 font-medium rounded-lg transition-colors text-lg"
            >
              Read the docs
            </a>
          </div>
          <p class="font-mono text-xs text-slate-500 mt-6">
            Works with{" "}
            <a
              href="https://prompt2bot.com"
              target="_blank"
              rel="noopener noreferrer"
              class="text-slate-300 hover:text-white underline underline-offset-4"
            >
              prompt2bot.com
            </a>{" "}
            · MIT licensed ·{" "}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="text-slate-300 hover:text-white underline underline-offset-4"
            >
              github.com/uriva/agentmail
            </a>
          </p>
        </div>
      </Section>

      <footer class="border-t border-slate-800 px-4 py-8 text-center text-slate-500 text-sm">
        <p class="font-mono text-xs">
          AgentMail — open source email for AI agents (MIT)
        </p>
        <div class="mt-3 flex items-center justify-center gap-4 flex-wrap">
          <a href="/docs" class="hover:text-white transition-colors">Docs</a>
          <span class="text-slate-700">|</span>
          <a href="/pricing" class="hover:text-white transition-colors">
            Pricing
          </a>
          <span class="text-slate-700">|</span>
          <a href="/privacy" class="hover:text-white transition-colors">
            Privacy
          </a>
          <span class="text-slate-700">|</span>
          <a href="/terms" class="hover:text-white transition-colors">Terms</a>
          <span class="text-slate-700">|</span>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <span class="text-slate-700">|</span>
          <a
            href="mailto:support@theagentmail.net"
            class="hover:text-white transition-colors"
          >
            support@theagentmail.net
          </a>
        </div>
      </footer>
    </div>
  );
};

export { Landing };
