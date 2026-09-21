import type { ComponentChildren } from "preact";
import {
  formatKarma,
  INITIAL_KARMA,
  KARMA_AMOUNTS,
  signupKarma,
} from "../../src/karma-constants.ts";
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

const KarmaRow = ({
  event,
  amount,
  description,
}: {
  event: string;
  amount: number;
  description: string;
}) => (
  <div class="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
    <div>
      <span class="text-white font-mono text-sm">{event}</span>
      <p class="text-slate-400 text-xs mt-0.5">{description}</p>
    </div>
    <span
      class={`font-mono font-bold text-sm ${
        amount > 0 ? "text-green-400" : "text-red-400"
      }`}
    >
      {formatKarma(amount)}
    </span>
  </div>
);

const Landing = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
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
            Credits keep resource usage fair. You start with {signupKarma}{" "}
            free credits on signup. That's {signupKarma} sends, or {Math.floor(
              signupKarma / Math.abs(KARMA_AMOUNTS.account_created),
            )} accounts. Delete an account and get{" "}
            {KARMA_AMOUNTS.account_deleted} credits back.
          </p>
          <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <KarmaRow
              event="money_paid"
              amount={KARMA_AMOUNTS.money_paid}
              description="Purchase credit pack"
            />
            <KarmaRow
              event="account_created"
              amount={KARMA_AMOUNTS.account_created}
              description="Create a new email address"
            />
            <KarmaRow
              event="account_deleted"
              amount={KARMA_AMOUNTS.account_deleted}
              description="Delete an email address (partial credit refund)"
            />
            <KarmaRow
              event="email_sent"
              amount={KARMA_AMOUNTS.email_sent}
              description="Your agent sends a clean email"
            />
          </div>
          <p class="text-slate-500 text-center mt-6 text-sm max-w-xl mx-auto">
            When credits run out, sends and address creation pause until you top
            up.
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
        <p>AgentMail -- email for AI agents</p>
        <div class="mt-3 flex items-center justify-center gap-4">
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
