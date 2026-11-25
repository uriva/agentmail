import type { ComponentChildren } from "preact";

const P = ({ children }: { children: ComponentChildren }) => (
  <p class="text-slate-400 text-sm leading-relaxed mb-3">{children}</p>
);

const H2 = ({ children }: { children: string }) => (
  <h2 class="text-lg font-semibold text-white mt-8 mb-3">{children}</h2>
);

const Ul = ({ children }: { children: ComponentChildren }) => (
  <ul class="text-slate-400 text-sm space-y-2 ml-4 list-disc mb-3">
    {children}
  </ul>
);

const Privacy = () => (
  <div class="max-w-2xl mx-auto pb-12">
    <h1 class="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
    <p class="text-slate-500 text-sm mb-8">Last updated: November 25, 2026</p>

    <P>
      AgentMail (available at{" "}
      <a
        href="https://theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        https://theagentmail.net
      </a>{" "}
      and{" "}
      <code class="text-slate-300">https://api.theagentmail.net</code>) is
      operated by <strong class="text-slate-300">Uri Holdings LLC</strong>, a
      New Mexico limited liability company ("we", "us", "our"). This Privacy
      Policy explains what personal data we collect, how we process and protect
      it, the third-party subprocessors we rely on, and the rights available to
      you.
    </P>

    <H2>1. Information we collect</H2>
    <P>
      <strong class="text-slate-300">Account &amp; authentication data.</strong>
      {" "}
      Your personal email address (used for passwordless magic-code login,
      organization membership, and account notices), organization name, and
      API key metadata (keys are stored solely as SHA-256 hashes alongside a
      short non-secret prefix).
    </P>
    <P>
      <strong class="text-slate-300">Phone verification data.</strong>{" "}
      To claim a free trial and prevent automated abuse, we collect and store
      your verified mobile phone number (normalized to E.164 format) and
      verification status via Twilio Verify.
    </P>
    <P>
      <strong class="text-slate-300">Billing &amp; payment metadata.</strong>
      {" "}
      When you add prepaid funds through Stripe Checkout, we store your prepaid
      balance, payment status, and processed Stripe checkout session IDs. We do
      not collect or store credit card numbers or bank details — those are
      handled directly by Stripe.
    </P>
    <P>
      <strong class="text-slate-300">Email content &amp; attachments.</strong>
      {" "}
      Messages sent and received through your{" "}
      <code class="text-slate-300">@theagentmail.net</code> mailboxes,
      including sender and recipient addresses, subject lines, headers,
      plain-text and HTML bodies, threading metadata, and attached files.
    </P>
    <P>
      <strong class="text-slate-300">
        Operational, quota &amp; security logs.
      </strong>{" "}
      We record block and quota warning event logs (to rate-limit automated
      alerts when messages are blocked or daily/monthly quotas are reached),
      mailbox send/receive counters, webhook delivery status metadata (target
      hostname, HTTP status, and event type), and standard Cloudflare Workers
      observability logs (request timestamps, paths, status codes, and error
      diagnostics).
    </P>
    <P>
      <strong class="text-slate-300">Privacy-minimized product analytics.</strong>
      {" "}
      We use PostHog to measure aggregate product usage (such as page views,
      account lifecycle events, and delivery counts). We do not send email
      subjects, email bodies, correspondent email addresses, your personal email
      address, or webhook secret paths/query parameters to PostHog.
    </P>
    <P>
      <strong class="text-slate-300">Support communications.</strong>{" "}
      Messages you send to{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      and related troubleshooting correspondence.
    </P>

    <H2>2. How we use your information &amp; automated AI scanning</H2>
    <P>We use collected data exclusively to operate, secure, and improve AgentMail:</P>
    <Ul>
      <li>
        <strong class="text-slate-300">Core email infrastructure</strong> —
        provisioning mailboxes, transmitting outbound mail, storing inbound mail
        and attachments, and dispatching webhooks to your configured endpoints.
      </li>
      <li>
        <strong class="text-slate-300">
          Real-time automated AI email scanning
        </strong>{" "}
        — inbound and outbound emails (including sender/recipient headers,
        subject lines, and bounded plain-text and HTML body content) are scanned
        in real time using the{" "}
        <strong class="text-slate-300">Google Gemini Decisions API</strong> (and
        fallback AI classification providers{" "}
        <strong class="text-slate-300">Respan</strong> and{" "}
        <strong class="text-slate-300">Jev</strong>) alongside pattern-based
        filters. This scanning blocks spam, phishing, credential harvesting, and
        deceptive impersonation to protect the shared{" "}
        <code class="text-slate-300">@theagentmail.net</code> domain, and
        identifies inbound signup, OTP, 2FA, and password-reset verification
        emails so they can be blocked and redacted on free-trial mailboxes.
      </li>
      <li>
        <strong class="text-slate-300">
          Anti-abuse, billing &amp; operational alerts
        </strong>{" "}
        — verifying unique phone numbers for free trials, processing prepaid
        balances and renewals, sending automated block/quota warning emails to
        your organization's billing/admin address, and sending internal
        operational notifications when new mailboxes are created on the shared
        domain.
      </li>
      <li>
        <strong class="text-slate-300">Customer support</strong> — responding to
        inquiries at{" "}
        <code class="text-slate-300">support@theagentmail.net</code> using human
        review and automated support tooling that can look up live organization
        and mailbox status metadata (with webhook secrets and full URLs
        redacted).
      </li>
    </Ul>
    <P>
      We do not sell your personal information, and we do not use your email
      content for targeted advertising.
    </P>

    <H2>3. Third-party subprocessors &amp; infrastructure</H2>
    <P>
      We rely on the following third-party providers to operate AgentMail. Each
      provider processes only the data required for its function under its own
      privacy terms and data processing commitments:
    </P>
    <Ul>
      <li>
        <strong class="text-slate-300">Resend</strong> — outbound email
        transmission, inbound email ingestion, and delivery of automated
        account, billing, quota, block, and internal new-mailbox monitoring
        alerts.
      </li>
      <li>
        <strong class="text-slate-300">InstantDB</strong> — hosted database and
        authentication infrastructure for users, organizations, mailboxes,
        messages, API key hashes, block/quota event logs, and webhook
        configurations.
      </li>
      <li>
        <strong class="text-slate-300">Google Cloud Storage</strong> — storage
        for email attachments and generation of time-limited signed download
        URLs.
      </li>
      <li>
        <strong class="text-slate-300">Cloudflare Workers</strong> — edge
        hosting for the web application, API, scheduled billing renewals, and
        operational observability logs.
      </li>
      <li>
        <strong class="text-slate-300">Stripe</strong> — payment processing and
        checkout for prepaid balance top-ups.
      </li>
      <li>
        <strong class="text-slate-300">Twilio (Twilio Verify)</strong> —
        one-time SMS verification codes for trial eligibility and anti-abuse
        enforcement.
      </li>
      <li>
        <strong class="text-slate-300">
          Google Gemini (with fallback providers Respan and Jev)
        </strong>{" "}
        — automated real-time AI classification of inbound and outbound email
        headers, subjects, and bodies for spam/phishing protection and
        free-trial verification-email detection.
      </li>
      <li>
        <strong class="text-slate-300">PostHog</strong> — privacy-minimized,
        non-content product analytics (no email contents, correspondent
        addresses, or secret webhook URLs).
      </li>
      <li>
        <strong class="text-slate-300">jsDelivr CDN</strong> — delivery of
        static frontend assets (such as code syntax highlighting libraries on
        documentation pages), which receives standard HTTP request headers
        including IP address and user agent.
      </li>
      <li>
        <strong class="text-slate-300">Automated support tooling</strong> —
        automated assistance for emails sent to{" "}
        <code class="text-slate-300">support@theagentmail.net</code>, operating
        alongside human oversight.
      </li>
    </Ul>

    <H2>4. Browser storage, cookies &amp; remote email content</H2>
    <P>
      <strong class="text-slate-300">Authentication storage.</strong> InstantDB
      uses browser storage (<code class="text-slate-300">IndexedDB</code> and{" "}
      <code class="text-slate-300">localStorage</code>) — rather than HTTP
      authentication cookies — to keep you signed in to the dashboard and sync
      live mailbox state.
    </P>
    <P>
      <strong class="text-slate-300">Cookieless analytics.</strong> PostHog is
      configured in memory-only, cookieless mode (
      <code class="text-slate-300">persistence: "memory"</code>) with
      autocapture and session recording disabled. We do not set tracking cookies
      or third-party advertising cookies, and we never record or replay your
      inbox UI.
    </P>
    <P>
      <strong class="text-slate-300">Remote images in HTML previews.</strong>{" "}
      HTML messages viewed in the dashboard are rendered inside a sandboxed
      iframe with scripts disabled, but may still load remote images hosted by
      external senders. Loading remote images can expose your IP address,
      browser user agent, or open timestamp to the sender's servers.
    </P>

    <H2>5. Data retention &amp; deletion</H2>
    <P>
      Mailbox messages, attachments, and webhook configurations are retained for
      as long as the associated mailbox exists. You can delete individual
      mailboxes at any time via the dashboard or{" "}
      <code class="text-slate-300">DELETE /v1/accounts/:accountId</code>, which
      permanently cascade-deletes the mailbox's messages, webhook subscriptions,
      and stored attachment files in Google Cloud Storage.
    </P>
    <P>
      To request deletion of your entire organization or user account, email{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      from your account email address. Please note that even after account
      deletion, we may retain limited records as reasonably necessary to comply
      with legal and accounting obligations (such as Stripe payment and
      transaction records), enforce anti-abuse controls (such as hashed or
      verified phone records to prevent repeated free-trial exploitation),
      resolve disputes, or complete standard third-party processor and backup
      expiration cycles.
    </P>

    <H2>6. Security</H2>
    <P>
      All traffic is encrypted in transit over HTTPS/TLS. API keys are stored as
      SHA-256 hashes and are never stored in plain text. Attachment downloads
      use short-lived signed URLs, and webhook deliveries are signed with
      HMAC-SHA256 timestamps so your agents can verify authenticity. No method
      of electronic transmission or storage is 100% secure, so we cannot
      guarantee absolute security.
    </P>

    <H2>7. Roles, GDPR legal bases &amp; international transfers</H2>
    <P>
      <strong class="text-slate-300">Controller vs. Processor role.</strong>{" "}
      Uri Holdings LLC acts as a Data Controller for account registration,
      authentication, phone verification, billing, support, analytics, and
      platform security data. With respect to email content and correspondent
      personal data transmitted through your agents' mailboxes, you are the Data
      Controller and Uri Holdings LLC acts as a Data Processor (or service
      provider), processing such data on your behalf to provide the service and
      enforce shared-domain anti-abuse protections.
    </P>
    <P>
      <strong class="text-slate-300">
        Legal bases under GDPR (Art. 6).
      </strong>{" "}
      If you are in the EEA, UK, or Switzerland, we process personal data under
      the following legal bases:
    </P>
    <Ul>
      <li>
        <strong class="text-slate-300">
          Performance of a contract (Art. 6(1)(b))
        </strong>{" "}
        — providing mailboxes, API access, message routing, webhooks, and
        prepaid billing you request.
      </li>
      <li>
        <strong class="text-slate-300">
          Legitimate interests (Art. 6(1)(f))
        </strong>{" "}
        — automated spam/phishing scanning, phone-verified anti-abuse controls,
        shared-domain reputation protection, operational logging, and
        privacy-minimized product analytics.
      </li>
      <li>
        <strong class="text-slate-300">
          Legal obligation (Art. 6(1)(c))
        </strong>{" "}
        — tax, accounting, fraud prevention, and lawful compliance requests.
      </li>
      <li>
        <strong class="text-slate-300">Consent (Art. 6(1)(a))</strong> — where
        expressly requested (such as optional communications).
      </li>
    </Ul>
    <P>
      <strong class="text-slate-300">International data transfers.</strong>{" "}
      Uri Holdings LLC is based in the United States, and our subprocessors
      operate globally. Where personal data is transferred outside the EEA, UK,
      or Switzerland to jurisdictions without an adequacy decision, we rely on
      appropriate safeguards such as the European Commission's Standard
      Contractual Clauses (SCCs) or equivalent lawful transfer mechanisms
      maintained by our subprocessors.
    </P>

    <H2>8. Your privacy rights (GDPR &amp; CCPA/CPRA)</H2>
    <P>
      <strong class="text-slate-300">EEA, UK &amp; Swiss residents.</strong>{" "}
      You have the right to request access to, correction of, or erasure of your
      personal data; to receive a portable copy of your data; to restrict or
      object to processing based on legitimate interests; to withdraw consent
      where processing is based on consent (without affecting prior lawful
      processing); and to lodge a complaint with your local data protection
      supervisory authority.
    </P>
    <P>
      <strong class="text-slate-300">California residents (CCPA/CPRA).</strong>
      {" "}
      Subject to statutory exceptions, you have the right to know the categories
      and specific pieces of personal information we collect, use, and disclose;
      the right to request deletion or correction of your personal information;
      and the right to be free from discrimination for exercising your privacy
      rights. We do not "sell" personal information or "share" personal
      information for cross-context behavioral advertising as those terms are
      defined under the CCPA/CPRA.
    </P>
    <P>
      To exercise any of these rights, email{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>
      . We may verify your identity via your registered email address before
      fulfilling a request.
    </P>

    <H2>9. Minimum age (18+)</H2>
    <P>
      AgentMail is intended solely for individuals who are at least 18 years old
      (or the age of legal majority in their jurisdiction). We do not knowingly
      collect personal data from anyone under 18. If you believe a minor has
      provided personal data to us, please contact{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      so we can promptly delete it.
    </P>

    <H2>10. Changes to this policy</H2>
    <P>
      We may update this Privacy Policy from time to time. When we make material
      changes, we will update the "Last updated" date above and notify you via
      the email address associated with your account.
    </P>

    <H2>11. Governing law &amp; contact</H2>
    <P>
      This Privacy Policy is governed by the laws of the State of New Mexico,
      United States, without regard to conflict-of-laws principles, except to the
      extent mandatory local data protection laws apply.
    </P>
    <P>
      Questions or privacy requests may be sent to{" "}
      <strong class="text-slate-300">Uri Holdings LLC</strong> at{" "}
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
