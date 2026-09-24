import type { ComponentChildren } from "preact";
import { useAuth } from "./db.ts";

const Section = ({
  children,
  class: className = "",
  id,
}: {
  children: ComponentChildren;
  class?: string;
  id?: string;
}) => <section id={id} class={`py-16 px-4 ${className}`}>{children}</section>;

const githubUrl = "https://github.com/uriva/agentmail";

const Badge = ({ children }: { children: ComponentChildren }) => (
  <span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border border-slate-700 bg-slate-800/60 text-slate-300">
    {children}
  </span>
);

const PlanRow = ({
  title,
  price,
  description,
}: {
  title: string;
  price: string;
  description: string;
}) => (
  <div class="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
    <div>
      <span class="text-white font-medium text-sm">{title}</span>
      <p class="text-slate-400 text-xs mt-0.5">{description}</p>
    </div>
    <span class="font-mono font-bold text-sm text-green-400">{price}</span>
  </div>
);

const Landing = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div>
      {/* Hero */}
      <Section class="pt-24 pb-12 text-center">
        <div class="flex gap-2 justify-center flex-wrap mb-6">
          <Badge>
            <span class="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            100% open source (MIT)
          </Badge>
          <Badge>1 mailbox free for 30 days</Badge>
          <Badge>$1/mo thereafter</Badge>
        </div>
        <h1 class="text-5xl sm:text-6xl font-extrabold text-white tracking-tight mb-6">
          Open source email for AI agents
        </h1>
        <p class="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Your agents need email. To sign up for GitHub, to receive verification
          codes, to communicate with people on their own behalf. You don't want
          to give them yours. You don't want to buy a domain for each one.
        </p>
        <p class="text-lg text-slate-400 max-w-xl mx-auto mb-10">
          AgentMail gives every agent its own{" "}
          <span class="text-white font-mono">@theagentmail.net</span>{" "}
          address. Not for newsletters or mass email. For agents that act as
          individuals in the world, and need a real mailbox to do it.
        </p>
        <div class="flex gap-4 justify-center flex-wrap">
          <a
            href={ctaHref}
            class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Get started
          </a>
          <a
            href="/docs"
            class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-medium rounded-lg transition-colors"
          >
            API docs
          </a>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-medium rounded-lg transition-colors"
          >
            ★ Star on GitHub
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
              operate as individuals, not as broadcast channels. And most of
              what they do requires email.
            </p>
            <p>
              Your options today are bad. Give the agent your personal email and
              lose control of your inbox. Buy a domain per agent and deal with
              DNS, DKIM, SPF, deliverability. Use a disposable email service and
              get blocked by every provider that checks reputation.
            </p>
            <p class="text-slate-300">
              AgentMail is a shared domain with reputation management built in.
              One API call to create an address. Built-in AI scanning keeps the
              domain clean. Your agent gets a real, trusted mailbox it can use
              as its own.
            </p>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section>
        <div class="max-w-3xl mx-auto">
          <h2 class="text-3xl font-bold text-white mb-4 text-center">
            How it works
          </h2>
          <p class="text-slate-400 text-center mb-10 max-w-xl mx-auto">
            Create an account, send and receive email, set up webhooks for
            real-time notifications. Everything via REST API or TypeScript SDK.
          </p>
          <div class="grid sm:grid-cols-3 gap-6">
            <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div class="text-3xl mb-3">1</div>
              <h3 class="text-white font-medium mb-2">Create an account</h3>
              <p class="text-slate-400 text-sm">
                One API call gives your agent a real{" "}
                <span class="font-mono text-slate-300">@theagentmail.net</span>
                {" "}
                address.
              </p>
            </div>
            <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div class="text-3xl mb-3">2</div>
              <h3 class="text-white font-medium mb-2">Send and receive</h3>
              <p class="text-slate-400 text-sm">
                Send email via API. Receive via polling or webhooks. Full
                attachment support.
              </p>
            </div>
            <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
              <div class="text-3xl mb-3">3</div>
              <h3 class="text-white font-medium mb-2">Automated protection</h3>
              <p class="text-slate-400 text-sm">
                Every outbound email is scanned by JEV. Phishing and spam blasts
                get stopped instantly, protecting deliverability for everyone.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Domain Protection & Credits */}
      <Section>
        <div class="max-w-2xl mx-auto">
          <h2 class="text-3xl font-bold text-white mb-4 text-center">
            How we keep the domain clean
          </h2>
          <p class="text-slate-400 text-center mb-4 max-w-xl mx-auto">
            Everyone shares one domain. If someone uses it for mass marketing
            blasts or phishing, the domain reputation tanks and everyone's mail
            lands in junk.
          </p>
          <p class="text-slate-400 text-center mb-4 max-w-xl mx-auto">
            Instead of manual reviews or awkward reciprocal games, every
            outbound email is evaluated in real time by JEV before it leaves the
            server. Phishing, credential harvesting, and cold spam blasts are
            blocked immediately. Legitimate agent communications, notifications,
            and human conversations go through cleanly.
          </p>
          <p class="text-slate-400 text-center mb-8 max-w-xl mx-auto">
            Simple, honest pricing. 1 mailbox free for 1 month upon phone verification.
            Rent mailboxes for just $1/month thereafter with a $5 minimum top-up.
          </p>
          <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <PlanRow
              title="1 Month Free Trial"
              price="$0"
              description="1 mailbox free for 30 days upon phone verification, 1,000 sends included"
            />
            <PlanRow
              title="Mailbox Rental"
              price="$1 / mo"
              description="Per active mailbox, 1,000 sends/mo included, unlimited inbound & webhooks"
            />
            <PlanRow
              title="Balance Top-Up"
              price="$5 min"
              description="Prepaid balance covers 5 mailbox-months, funds never expire"
            />
            <PlanRow
              title="Inbound & Webhooks"
              price="Free"
              description="Receive emails, download attachments, and trigger webhooks at zero cost"
            />
          </div>
          <p class="text-slate-500 text-center mt-6 text-sm max-w-xl mx-auto">
            When balance runs out, mailboxes are paused until topped up. Inbound emails
            are preserved during a grace period.
          </p>
        </div>
      </Section>

      {/* Works with */}
      <Section class="text-center">
        <p class="text-slate-400 text-sm">
          Works with{" "}
          <a
            href="https://prompt2bot.com"
            class="text-blue-400 hover:text-blue-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            prompt2bot.com
          </a>{" "}
          to create agents that send and receive email out of the box.
        </p>
      </Section>

      {/* Open source */}
      <Section>
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-3xl font-bold text-white mb-4">
            Completely open source
          </h2>
          <p class="text-slate-400 mb-6 max-w-xl mx-auto">
            MIT licensed. Backend, frontend, SDK, and infrastructure — all
            public on GitHub. Self-host it, audit the code, or contribute.
            No black boxes touching your agents' email.
          </p>
          <div class="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6 text-left overflow-x-auto">
            <code class="font-mono text-sm text-green-400">
              git clone https://github.com/uriva/agentmail.git
            </code>
          </div>
          <div class="flex gap-4 justify-center flex-wrap">
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="px-6 py-3 bg-slate-100 hover:bg-white text-slate-900 font-medium rounded-lg transition-colors"
            >
              View source on GitHub
            </a>
            <a
              href={`${githubUrl}/blob/main/README.md`}
              target="_blank"
              rel="noopener noreferrer"
              class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-medium rounded-lg transition-colors"
            >
              Self-host guide
            </a>
          </div>
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
        <div class="flex gap-4 justify-center flex-wrap">
          <a
            href={ctaHref}
            class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-lg"
          >
            Get started
          </a>
          <a
            href="/docs"
            class="px-8 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-medium rounded-lg transition-colors text-lg"
          >
            Read the docs
          </a>
        </div>
      </Section>

      {/* Footer */}
      <footer class="border-t border-slate-800 py-8 px-4 text-center text-slate-500 text-sm">
        <p>AgentMail — open source email for AI agents (MIT)</p>
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
