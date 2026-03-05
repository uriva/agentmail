import type { ComponentChildren } from "preact";

const P = ({
  children,
}: {
  children: ComponentChildren;
}) => <p class="text-slate-400 text-sm leading-relaxed mb-3">{children}</p>;

const H2 = ({ children }: { children: string }) => (
  <h2 class="text-lg font-semibold text-white mt-8 mb-3">{children}</h2>
);

const Terms = () => (
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-white mb-2">Terms of Service</h1>
    <p class="text-slate-500 text-sm mb-8">Last updated: February 2026</p>

    <P>
      AgentMail ("we", "us") provides email accounts for AI agents via a
      REST API. By using the service, you agree to these terms.
    </P>

    <H2>The service</H2>
    <P>
      AgentMail lets you create email accounts on the shared domain
      theagentmail.net. Your AI agents can send and receive email through
      these accounts using our API or TypeScript SDK.
    </P>
    <P>
      All accounts share one domain. The domain's reputation depends on
      everyone using it responsibly. That's why the karma system exists.
    </P>

    <H2>Account creation</H2>
    <P>
      You need a personal email address from a trusted provider (Gmail,
      Outlook, Yahoo, ProtonMail, iCloud, etc.) to sign up. You must be at
      least 13 years old. Each user can create one organization by default.
      Contact us if you need more.
    </P>

    <H2>Acceptable use</H2>
    <P>This is the important part. You may not use AgentMail to:</P>
    <ul class="text-slate-400 text-sm space-y-2 ml-4 list-disc mb-3">
      <li>
        Send unsolicited bulk email (spam). This is the big one. AgentMail
        is for agents acting as individuals, not for mass email campaigns.
      </li>
      <li>
        Send malware, phishing attempts, or other malicious content.
      </li>
      <li>
        Impersonate real people or organizations. Your agent can have a
        persona, but it shouldn't pretend to be someone it's not.
      </li>
      <li>Violate any applicable laws or regulations.</li>
      <li>
        Attempt to game the karma system (creating fake accounts to generate
        karma, sending emails to yourself from throwaway addresses, etc.).
      </li>
      <li>
        Use the service in any way that damages the shared domain's
        reputation or deliverability for other users.
      </li>
    </ul>

    <H2>Karma system</H2>
    <P>
      The karma system governs your ability to send email and create
      accounts. Sending costs karma. Receiving replies from real people earns
      it back. When karma runs out, sends and account creation are blocked.
    </P>
    <P>
      We reserve the right to modify karma costs and rewards. We'll try to
      communicate significant changes in advance.
    </P>

    <H2>API keys</H2>
    <P>
      Your API keys provide access to your organization's accounts and data.
      Keep them secret. You're responsible for any activity that occurs using
      your keys. If you believe a key has been compromised, delete it from
      the dashboard immediately and create a new one.
    </P>

    <H2>Content ownership</H2>
    <P>
      You own the content your agents send and receive. By using the service,
      you grant us a limited license to process, store, and transmit that
      content as necessary to operate the service. We don't use your content
      for anything else.
    </P>

    <H2>Termination</H2>
    <P>
      We may suspend or terminate accounts that violate these terms,
      particularly the acceptable use policy. Accounts engaged in spamming
      will be terminated immediately and without warning, since they threaten
      the service for all users.
    </P>
    <P>
      You can stop using the service at any time. Delete your accounts and
      organization from the dashboard.
    </P>

    <H2>Service availability</H2>
    <P>
      We aim for high availability but don't guarantee 100% uptime. The
      service is provided "as is". We're not liable for missed emails,
      delayed deliveries, or temporary outages.
    </P>

    <H2>Liability</H2>
    <P>
      To the maximum extent permitted by law, AgentMail is not liable for
      any indirect, incidental, or consequential damages arising from your
      use of the service. Our total liability is limited to the amount
      you've paid us in the 12 months preceding the claim.
    </P>

    <H2>Indemnification</H2>
    <P>
      You agree to indemnify and hold AgentMail harmless from any claims,
      damages, or expenses arising from your use of the service, your
      agents' behavior, or your violation of these terms. If your agent
      sends something that gets us in trouble, that's on you.
    </P>

    <H2>Governing law</H2>
    <P>
      These terms are governed by the laws of the State of New Mexico, United
      States. Any disputes will be resolved in the courts of New Mexico.
    </P>

    <H2>Changes</H2>
    <P>
      We may update these terms. Continued use of the service after changes
      constitutes acceptance. We'll communicate significant changes via email.
    </P>

    <H2>Contact</H2>
    <P>
      Questions about these terms? Email{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>
      .
    </P>
  </div>
);

export { Terms };
