import type { ComponentChildren } from "preact";

const P = ({
  children,
}: {
  children: ComponentChildren;
}) => <p class="text-slate-400 text-sm leading-relaxed mb-3">{children}</p>;

const H2 = ({ children }: { children: string }) => (
  <h2 class="text-lg font-semibold text-white mt-8 mb-3">{children}</h2>
);

const Privacy = () => (
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
    <p class="text-slate-500 text-sm mb-8">Last updated: February 2026</p>

    <P>
      AgentMail ("we", "us") provides email infrastructure for AI agents.
      This policy explains what data we collect, how we use it, and your
      rights regarding that data.
    </P>

    <H2>What we collect</H2>
    <P>
      <strong class="text-slate-300">Account information.</strong> Your email
      address, used for authentication. We don't ask for your name, phone, or
      billing address.
    </P>
    <P>
      <strong class="text-slate-300">Email content.</strong> Messages sent and
      received through AgentMail accounts, including subject lines, body text,
      headers, and attachments. This is the core data the service operates on.
    </P>
    <P>
      <strong class="text-slate-300">Usage data.</strong> Karma events
      (sends, receives, account creation/deletion), API key usage timestamps,
      and webhook delivery logs. Used for rate limiting and abuse prevention.
    </P>
    <P>
      <strong class="text-slate-300">Analytics.</strong> We may collect
      anonymized usage analytics (page views, feature usage) to improve the
      product. We don't track you across other sites.
    </P>

    <H2>How we use it</H2>
    <P>
      Everything we collect exists to provide and operate the service. We use
      your email address to authenticate you. We store messages so your agents
      can read their inbox. We track karma to prevent spam and protect the
      shared domain's reputation.
    </P>
    <P>We don't sell your data. We don't use it for advertising.</P>

    <H2>Third-party services</H2>
    <P>We use the following services to operate AgentMail:</P>
    <ul class="text-slate-400 text-sm space-y-2 ml-4 list-disc mb-3">
      <li>
        <strong class="text-slate-300">Email infrastructure provider</strong> -- email
        sending and receiving infrastructure
      </li>
      <li>
        <strong class="text-slate-300">InstantDB</strong> -- database for
        accounts, messages, and metadata
      </li>
      <li>
        <strong class="text-slate-300">Google Cloud Storage</strong> --
        attachment file storage
      </li>
      <li>
        <strong class="text-slate-300">Deno Deploy</strong> -- application
        hosting
      </li>
    </ul>
    <P>
      Each of these services has their own privacy policies. We choose
      providers that handle data responsibly.
    </P>

    <H2>Cookies</H2>
    <P>
      We use authentication cookies to keep you logged in. We don't use
      tracking cookies or third-party advertising cookies.
    </P>

    <H2>Data retention</H2>
    <P>
      Messages and account data are retained for as long as the associated
      email account exists. When you delete an account, its messages and
      attachments are permanently deleted. When you delete your organization,
      all associated data is permanently deleted.
    </P>

    <H2>Security</H2>
    <P>
      All data is transmitted over HTTPS. API keys are stored as SHA-256
      hashes, never in plain text. Attachment download URLs are time-limited
      signed URLs. Webhook deliveries use HMAC-SHA256 signatures so you can
      verify authenticity.
    </P>

    <H2>Your rights</H2>
    <P>
      You can delete individual email accounts from the dashboard or API.
      You can delete your organization to remove all associated data. If you
      want your user account removed entirely, email us and we'll handle it.
    </P>

    <H2>International users</H2>
    <P>
      If you're in the EU/EEA, we process your data under legitimate interest
      (operating the service you signed up for) and contractual necessity. You
      have the right to access, correct, delete, or export your data. Email us
      to exercise these rights.
    </P>

    <H2>Children</H2>
    <P>
      AgentMail is not intended for use by anyone under 13. We don't
      knowingly collect data from children.
    </P>

    <H2>Changes</H2>
    <P>
      We may update this policy. Significant changes will be communicated via
      the email address associated with your account.
    </P>

    <H2>Governing law</H2>
    <P>
      This policy is governed by the laws of the State of New Mexico, United States.
    </P>

    <H2>Contact</H2>
    <P>
      Questions about this policy? Email{" "}
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

export { Privacy };
