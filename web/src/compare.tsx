import { useAuth } from "./db.ts";
import { planDetails } from "../../src/planData.ts";

const githubUrl = "https://github.com/uriva/agentmail";

const rows = [
  [
    "License & transparency",
    "100% open source (MIT)",
    "Closed-source SaaS",
    "DIY / varies",
  ],
  [
    "Self-hostable",
    "Yes (Cloudflare Workers + Resend)",
    "No",
    "Manual DNS + SMTP/IMAP",
  ],
  [
    "Free tier",
    "1 mailbox free for 30 days",
    "3 free inboxes (limited)",
    "Free on personal Gmail",
  ],
  [
    "Paid pricing",
    "$1/mo per mailbox ($5 prepaid, never expires)",
    "Platform plans + $2/extra inbox",
    "$10–15/yr domain + email host",
  ],
  [
    "150 mailboxes / mo",
    "$150/mo (no platform fee)",
    "$200/mo Startup plan",
    "High DNS & warmup overhead",
  ],
  [
    "500 mailboxes / mo",
    "$500/mo flat",
    "$900/mo ($200 + 350 × $2)",
    "Deliverability firefighting",
  ],
  [
    "Outbound abuse protection",
    "Real-time AI spam & phishing filter",
    "Account-level enforcement",
    "None (domain gets burned)",
  ],
  [
    "Agent discovery",
    "Remote MCP (/mcp), REST API, webhooks, /llms.txt, OpenCode skill",
    "SDK + REST API",
    "IMAP/SMTP boilerplate",
  ],
] as const;

const faqs = [
  {
    q: "How is theagentmail.net different from agentmail.to?",
    a: "theagentmail.net (github.com/uriva/agentmail) is a 100% MIT open-source email infrastructure for AI agents with flat $1/mo per-mailbox prepaid pricing, zero platform fees, a real-time AI outbound spam/phishing guard, and full self-hosting on Cloudflare Workers.",
  },
  {
    q: "Why does the free trial require phone verification and block OTP emails?",
    a: "Disposable burner abuse destroys shared email deliverability for everyone. Requiring phone verification for the 30-day free trial and unlocking signup/OTP emails with a $5 prepaid deposit (5 mailbox-months, never expires) keeps @theagentmail.net trusted by GitHub, Slack, Linear, and major inbox providers.",
  },
  {
    q: "Can I self-host AgentMail on my own domain?",
    a: "Yes. The entire backend, frontend, Durable Object security guards, and spam filter are MIT licensed on GitHub. Clone the repo, point EMAIL_DOMAIN at your domain on Resend, and deploy to Cloudflare Workers.",
  },
];

const compareFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const Compare = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div class="max-w-4xl mx-auto py-6">
      <script type="application/ld+json">
        {JSON.stringify(compareFaqSchema)}
      </script>

      <div class="mb-10">
        <p class="font-mono text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
          Compare
        </p>
        <h1 class="display-serif text-4xl sm:text-5xl text-white mb-4">
          Open-source agent email, half the price.
        </h1>
        <p class="text-slate-400 text-lg max-w-2xl leading-relaxed">
          If you want dedicated email inboxes for AI agents without a $200/mo
          platform tier, closed-source lock-in, or giving an agent your personal
          Gmail, here is how{" "}
          <span class="font-mono text-slate-200">theagentmail.net</span>{" "}
          compares.
        </p>
      </div>

      <div class="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/60 mb-12">
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-700 bg-slate-800/60">
              <th class="p-4 text-slate-400 font-medium">Feature</th>
              <th class="p-4 text-blue-400 font-semibold">
                AgentMail (theagentmail.net)
              </th>
              <th class="p-4 text-slate-300 font-medium">agentmail.to</th>
              <th class="p-4 text-slate-400 font-medium">
                DIY (Gmail / own domain)
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            {rows.map(([label, ours, competitor, diy]) => (
              <tr key={label} class="hover:bg-slate-800/30">
                <td class="p-4 text-slate-300 font-medium">{label}</td>
                <td class="p-4 text-white font-medium">{ours}</td>
                <td class="p-4 text-slate-400">{competitor}</td>
                <td class="p-4 text-slate-400">{diy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="grid sm:grid-cols-3 gap-4 mb-12">
        <div class="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
          <h2 class="text-white font-semibold mb-2">No platform tax</h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Pay {planDetails.rental.priceDisplay}/mo per active mailbox from a{" "}
            {planDetails.topup.priceDisplay} prepaid balance that never expires.
            Run 1 agent or 500 without jumping to a $200/mo plan.
          </p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
          <h2 class="text-white font-semibold mb-2">MIT open source</h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Audit every line of the worker, webhook verification, and spam
            filter on GitHub. Start hosted on{" "}
            <span class="font-mono text-slate-200">@theagentmail.net</span> and
            self-host whenever you want.
          </p>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
          <h2 class="text-white font-semibold mb-2">Built-in abuse guard</h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Every outbound email is scanned in real time for phishing and spam
            blasts before leaving the server, protecting deliverability for
            legitimate agent workflows.
          </p>
        </div>
      </div>

      <div class="mb-12">
        <h2 class="text-2xl font-bold text-white mb-5">Common questions</h2>
        <div class="divide-y divide-slate-800 border-y border-slate-800">
          {faqs.map((f) => (
            <div key={f.q} class="py-5">
              <h3 class="text-slate-100 font-medium mb-2">{f.q}</h3>
              <p class="text-slate-400 text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div class="rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] p-8 text-center">
        <h2 class="text-2xl font-bold text-white mb-2">
          Give your agent an inbox in 2 minutes
        </h2>
        <p class="text-slate-400 text-sm mb-6">
          1 mailbox free for 30 days, then $1/mo. Or point your agent at{" "}
          <a
            href="https://theagentmail.net/llms.txt"
            class="text-blue-400 hover:text-blue-300 font-mono"
          >
            /llms.txt
          </a>
          .
        </p>
        <div class="flex flex-wrap gap-3 justify-center">
          <a
            href={ctaHref}
            class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Create an inbox →
          </a>
          <a
            href="/docs"
            class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-200 font-medium rounded-lg transition-colors"
          >
            Read API docs
          </a>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 font-mono text-sm rounded-lg transition-colors"
          >
            ★ View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
};
