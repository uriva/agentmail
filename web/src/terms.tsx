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

const Terms = () => (
  <div class="max-w-2xl mx-auto pb-12">
    <h1 class="text-3xl font-bold text-white mb-2">Terms of Service</h1>
    <p class="text-slate-500 text-sm mb-8">Last updated: November 25, 2026</p>

    <P>
      These Terms of Service ("Terms") govern your access to and use of the
      hosted AgentMail service at{" "}
      <a
        href="https://theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        https://theagentmail.net
      </a>{" "}
      and{" "}
      <code class="text-slate-300">https://api.theagentmail.net</code>{" "}
      (collectively, the "Service"), operated by{" "}
      <strong class="text-slate-300">Uri Holdings LLC</strong>, a New Mexico
      limited liability company ("we", "us", "our"). By creating an account,
      calling our API, or using the Service, you agree to these Terms and our{" "}
      <a href="/privacy" class="text-blue-400 hover:text-blue-300 underline">
        Privacy Policy
      </a>
      .
    </P>

    <H2>1. Eligibility &amp; account creation</H2>
    <P>
      You must be at least <strong class="text-slate-300">18 years old</strong>{" "}
      (or the age of legal majority in your jurisdiction, if higher) to use the
      Service. If you use the Service on behalf of a company or other legal
      entity, you represent that you have authority to bind that entity to these
      Terms.
    </P>
    <P>
      Account registration requires a personal email address from a supported
      provider. Each user may create one organization by default; contact{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      to request additional organizations. You are responsible for safeguarding
      your account credentials and API keys and for all activity conducted under
      them. If an API key is compromised, revoke it immediately in the
      dashboard.
    </P>

    <H2>2. Free trial restrictions</H2>
    <P>
      Eligible organizations may claim one free trial mailbox for 30 days after
      completing one-time SMS phone verification via Twilio Verify. Free-trial
      mailboxes are subject to the following restrictions:
    </P>
    <Ul>
      <li>
        <strong class="text-slate-300">Reduced quotas</strong> — lower daily and
        monthly send and receive caps apply compared to paid mailboxes.
      </li>
      <li>
        <strong class="text-slate-300">
          Verification emails blocked &amp; redacted
        </strong>{" "}
        — inbound third-party signup confirmations, one-time passcodes (OTPs),
        two-factor authentication (2FA) codes, magic login links, account
        activation links, and password-reset emails are automatically blocked
        and redacted on free-trial mailboxes to prevent burner-account abuse.
        Adding a $5 minimum prepaid deposit unlocks future verification emails
        for your organization.
      </li>
      <li>
        <strong class="text-slate-300">Automated admin alerts</strong> — we may
        send automated alert emails to your organization's billing/admin email
        address when messages are blocked or when daily or monthly send/receive
        quotas are exceeded.
      </li>
    </Ul>

    <H2>3. Prepaid balance, billing, auto-renewal &amp; refunds</H2>
    <P>
      <strong class="text-slate-300">Prepaid deposits.</strong> Paid usage is
      funded via a prepaid organization balance topped up through Stripe
      Checkout ($5.00 USD minimum deposit, covering 5 mailbox-months). Prepaid
      balance funds do not expire while your organization remains active and in
      good standing.
    </P>
    <P>
      <strong class="text-slate-300">
        Mailbox rental &amp; automatic renewal.
      </strong>{" "}
      Each active paid mailbox costs $1.00 USD per 30-day period. At the end of
      each 30-day period, active mailboxes automatically renew by deducting
      $1.00 USD from your organization's prepaid balance.
    </P>
    <P>
      <strong class="text-slate-300">
        Immediate pause/freeze on insufficient balance.
      </strong>{" "}
      If your balance is below $1.00 USD when a mailbox's 30-day period expires,
      the mailbox is immediately expired and frozen. While frozen or expired,{" "}
      <strong class="text-slate-300">
        both outbound sending and inbound email delivery are paused
      </strong>{" "}
      — inbound messages sent to a frozen or expired mailbox are dropped rather
      than queued — until you top up your balance to reactivate the mailbox.
    </P>
    <P>
      <strong class="text-slate-300">Refund policy &amp; unused balance.</strong>
      {" "}
      Prepaid deposits and mailbox rental charges are non-refundable except
      where required by applicable law. If you voluntarily close your
      organization in good standing, you may email{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      within 30 days of closure to request a refund review of unused whole-dollar
      prepaid balance (net of non-refundable payment processing fees where
      permitted). If your account or organization is suspended or terminated for
      violating these Terms or our Acceptable Use rules, any remaining prepaid
      balance is forfeited.
    </P>
    <P>
      <strong class="text-slate-300">Currency, taxes &amp; price changes.</strong>
      {" "}
      All amounts are stated in U.S. Dollars (USD) and exclude sales, use, VAT,
      GST, or other applicable taxes, which are your responsibility. We may
      modify pricing, quotas, or trial terms upon notice; changes take effect on
      subsequent billing periods or deposits.
    </P>

    <H2>4. Email acceptable use, deliverability &amp; filtering</H2>
    <P>
      All hosted mailboxes share the{" "}
      <code class="text-slate-300">@theagentmail.net</code> domain. Because
      domain reputation affects every customer, you agree to the following rules
      and limitations:
    </P>
    <Ul>
      <li>
        <strong class="text-slate-300">
          Anti-spam &amp; legal compliance
        </strong>{" "}
        — you must comply with CAN-SPAM, GDPR, CASL, and all other applicable
        anti-spam, privacy, and electronic communications laws. You may not send
        unsolicited bulk email (spam), phishing, credential harvesting, malware,
        scams, extortion, deceptive impersonation, or unlawful content, nor
        circumvent trial, phone-verification, or rate limits.
      </li>
      <li>
        <strong class="text-slate-300">Reserved mailbox names</strong> —
        administrative, security, system, and brand-related mailbox names and
        display names (such as{" "}
        <code class="text-slate-300">admin</code>,{" "}
        <code class="text-slate-300">support</code>,{" "}
        <code class="text-slate-300">postmaster</code>,{" "}
        <code class="text-slate-300">abuse</code>,{" "}
        <code class="text-slate-300">security</code>, and similar restricted
        terms) are reserved and may not be claimed.
      </li>
      <li>
        <strong class="text-slate-300">
          Silent over-quota inbound drops
        </strong>{" "}
        — inbound messages received after a mailbox reaches its daily or monthly
        receive quota (or while the mailbox is frozen/expired) are silently
        dropped without queueing or delivery guarantees.
      </li>
      <li>
        <strong class="text-slate-300">
          Automated filtering disclaimers
        </strong>{" "}
        — all inbound and outbound emails are inspected in real time by
        automated AI and rule-based spam, phishing, and verification filters.
        Automated filtering may produce false positives (blocking or redacting
        legitimate messages) or false negatives (failing to catch abusive
        messages). We are not liable for any filtering classification or blocked
        message.
      </li>
      <li>
        <strong class="text-slate-300">
          Shared domain deliverability &amp; third-party blocklists
        </strong>{" "}
        — we manage domain health in good faith, but we do not guarantee inbox
        placement, delivery speed, or acceptance by third-party mail servers.
        Third-party providers, spam filters, or blocklists may rate-limit,
        quarantine, or reject mail from shared domains at their sole discretion.
      </li>
      <li>
        <strong class="text-slate-300">
          No regulated or high-risk data
        </strong>{" "}
        — the Service is not HIPAA-compliant or PCI-DSS-certified. You may not
        use AgentMail to transmit, receive, or store Protected Health
        Information (PHI), payment cardholder data, government-classified
        information, or other regulated sensitive data requiring specialized
        compliance certifications.
      </li>
      <li>
        <strong class="text-slate-300">
          Autonomous AI agent accountability
        </strong>{" "}
        — you are solely responsible and legally liable for all emails, signups,
        representations, API calls, and interactions initiated or performed by
        any autonomous AI agent, script, or third-party tool operating through
        your mailboxes or API keys.
      </li>
    </Ul>

    <H2>5. Inactivity, expiration &amp; address recycling</H2>
    <P>
      Mailboxes on <code class="text-slate-300">@theagentmail.net</code> are
      rented on an active prepaid or trial basis and are not permanent property.
      If a trial expires, a mailbox remains unpaid or frozen, or an account is
      deleted or terminated, we may delete the mailbox and its data and release
      or reassign the email address to another user. You are solely responsible
      for migrating third-party logins or accounts tied to an address before
      expiration or deletion.
    </P>

    <H2>6. Content ownership &amp; license</H2>
    <P>
      You retain ownership of the content your agents send and receive. You
      grant Uri Holdings LLC a limited, worldwide, royalty-free license to host,
      process, scan, transmit, store, and display that content solely as
      necessary to operate, maintain, and secure the Service.
    </P>

    <H2>7. MIT open-source software vs. hosted Service</H2>
    <P>
      The AgentMail source code published on GitHub is made available under the
      MIT License. Your rights to copy, modify, and self-host that source code
      on your own infrastructure are governed solely by the MIT License. These
      Terms govern your use of the hosted Service operated by Uri Holdings LLC
      at <code class="text-slate-300">theagentmail.net</code> and{" "}
      <code class="text-slate-300">api.theagentmail.net</code>, including our
      shared domain, managed infrastructure, and trademarks. Nothing in the MIT
      License grants you any right to use our hosted infrastructure or domain
      outside these Terms.
    </P>

    <H2>8. Suspension &amp; termination</H2>
    <P>
      We may immediately suspend or terminate your mailboxes, API keys, or
      organization — without prior notice — if we reasonably believe you or your
      agents have violated these Terms, engaged in spam, phishing, or abuse, or
      created risk for the shared domain or other users. You may stop using the
      Service at any time by deleting your mailboxes via the dashboard or API
      and emailing{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      to close your organization.
    </P>

    <H2>9. Disclaimer of warranties</H2>
    <P>
      <strong class="text-slate-300">
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
        ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW,
        URI HOLDINGS LLC DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES
        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
        NON-INFRINGEMENT, UNINTERRUPTED AVAILABILITY, ERROR-FREE OPERATION, AND
        EMAIL DELIVERABILITY.
      </strong>{" "}
      We do not guarantee 100% uptime and are not responsible for missed,
      delayed, dropped, or filtered emails or temporary outages.
    </P>

    <H2>10. Limitation of liability</H2>
    <P>
      TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL URI
      HOLDINGS LLC OR ITS MEMBERS, OFFICERS, EMPLOYEES, OR SUPPLIERS BE LIABLE
      FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
      PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR
      BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO THESE TERMS OR THE
      SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
    </P>
    <P>
      TO THE MAXIMUM EXTENT PERMITTED BY LAW, URI HOLDINGS LLC'S TOTAL AGGREGATE
      LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE
      SERVICE WILL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU TO
      URI HOLDINGS LLC FOR THE SERVICE IN THE TWELVE (12) MONTHS IMMEDIATELY
      PRECEDING THE EVENT GIVING RISE TO LIABILITY, OR (B) FIFTY U.S. DOLLARS
      ($50.00 USD).
    </P>

    <H2>11. Indemnification</H2>
    <P>
      You agree to defend, indemnify, and hold harmless Uri Holdings LLC and its
      affiliates, members, and service providers from and against any claims,
      liabilities, damages, losses, and expenses (including reasonable
      attorneys' fees) arising out of or related to your use of the Service,
      content sent or received by you or your AI agents, your violation of these
      Terms, or your infringement of any law or third-party right.
    </P>

    <H2>12. DMCA, copyright &amp; abuse reporting</H2>
    <P>
      To report spam, phishing, abuse, or alleged copyright infringement (DMCA
      takedown notices) involving any{" "}
      <code class="text-slate-300">@theagentmail.net</code> address, email{" "}
      <a
        href="mailto:support@theagentmail.net"
        class="text-blue-400 hover:text-blue-300"
      >
        support@theagentmail.net
      </a>{" "}
      with the relevant mailbox address, message headers or timestamps,
      description of the issue or copyrighted work, and your contact
      information. We respond promptly to valid abuse and takedown notices and
      terminate repeat infringers in appropriate circumstances.
    </P>

    <H2>13. General legal terms</H2>
    <Ul>
      <li>
        <strong class="text-slate-300">Governing law &amp; venue</strong> —
        these Terms are governed by the laws of the State of New Mexico, United
        States, without regard to conflict-of-laws principles. Any dispute
        arising from these Terms or the Service shall be brought exclusively in
        the state or federal courts located in New Mexico, and you consent to
        personal jurisdiction there.
      </li>
      <li>
        <strong class="text-slate-300">Entire agreement</strong> — these Terms,
        together with our Privacy Policy, constitute the entire agreement
        between you and Uri Holdings LLC regarding the hosted Service and
        supersede any prior agreements.
      </li>
      <li>
        <strong class="text-slate-300">Severability</strong> — if any provision
        of these Terms is found unenforceable, the remaining provisions will
        continue in full force and effect.
      </li>
      <li>
        <strong class="text-slate-300">Force majeure</strong> — we are not
        liable for delays or failures caused by events beyond our reasonable
        control, including upstream provider outages, network failures, natural
        disasters, war, or governmental actions.
      </li>
      <li>
        <strong class="text-slate-300">Export controls &amp; sanctions</strong>
        {" "}
        — you may not use the Service if you are located in a U.S.-embargoed
        jurisdiction or listed on any U.S. government restricted-party list, and
        you agree to comply with all applicable export control and sanctions
        laws.
      </li>
      <li>
        <strong class="text-slate-300">Assignment</strong> — you may not assign
        these Terms without our prior written consent. We may assign these Terms
        in connection with a merger, acquisition, reorganization, or sale of
        assets.
      </li>
      <li>
        <strong class="text-slate-300">Survival</strong> — sections concerning
        fees owed, acceptable use responsibility, content licenses, disclaimers,
        limitations of liability, indemnification, governing law, and general
        terms survive termination.
      </li>
    </Ul>

    <H2>14. Changes &amp; contact</H2>
    <P>
      We may update these Terms from time to time. We will post the updated
      Terms with a revised "Last updated" date and notify you by email of
      material changes. Continued use of the Service after updated Terms take
      effect constitutes acceptance.
    </P>
    <P>
      Questions about these Terms? Contact{" "}
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

export { Terms };
