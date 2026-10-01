export const planDetails = {
  trial: {
    title: "Trial",
    name: "Free trial",
    price: 0,
    priceDisplay: "$0",
    durationDays: 30,
    durationMonths: 1,
    durationDisplay: "1 mailbox · 30 days",
    mailboxesIncluded: 1,
    sendsPerDay: 20,
    sendsIncluded: 100,
    receivesPerDay: 50,
    receivesIncluded: 200,
    requiresPhoneVerification: true,
    badgeText: "1 mailbox free · 30 days",
    summary:
      "One mailbox is free for 30 days after phone verification (20 sends/day, 50 receives/day, up to 100 sends & 200 receives/mo). Inbound & webhooks included.",
    features: [
      "1 email inbox free for 30 days",
      "Phone-verified to prevent abuse",
      "20 sends/day (100 sends/mo included)",
      "50 receives/day (200 receives/mo included)",
      "Unlimited webhooks & API access",
      "Full attachment support",
      "Real-time AI spam & phishing protection",
    ],
  },
  rental: {
    title: "Mailbox",
    name: "Mailbox rental",
    priceDollars: 1,
    priceDisplay: "$1",
    badgeText: "then $1/mo",
    periodDisplay: "/mo per active mailbox",
    periodDisplayLong: "per mailbox / month",
    sendsPerMonth: 1000,
    sendsPerDay: 200,
    sendsDisplay: "1,000 sends/mo (200/day)",
    receivesPerMonth: 1000,
    receivesPerDay: 200,
    receivesDisplay: "1,000 receives/mo (200/day)",
    summary:
      "1,000 sends/mo & 1,000 receives/mo included (200/day cap). Pause anytime.",
    features: [
      "$5 minimum deposit (5 mailbox-months)",
      "Deposit funds never expire",
      "1,000 sends/mo included (200/day)",
      "1,000 receives/mo included (200/day)",
      "Unlimited webhooks",
      "Add as many agent mailboxes as you need",
      "Self-serve instant Stripe checkout",
    ],
  },
  topup: {
    title: "Top-up",
    minAmountDollars: 5,
    priceDisplay: "$5",
    periodDisplay: "minimum, never expires",
    summary:
      "Prepaid balance = 5 mailbox-months. Covers renewals automatically.",
  },
  limits: {
    trial: {
      sendsPerDay: 20,
      sendsPerMonth: 100,
      receivesPerDay: 50,
      receivesPerMonth: 200,
    },
    paid: {
      sendsPerDay: 200,
      sendsPerMonth: 1000,
      receivesPerDay: 200,
      receivesPerMonth: 1000,
    },
    sendsPerMonthPerMailbox: 1000,
    minTopupDollars: 5,
    mailboxMonthlyCostDollars: 1,
    trialDays: 30,
  },
  faqCostAnswer:
    "One mailbox is free for 30 days after phone verification (20 sends/day, 50 receives/day, up to 100 sends & 200 receives/mo). Paid mailboxes ($1/mo) include 1,000 sends & 1,000 receives per month (200/day). Inbound emails and webhooks are included.",
} as const;

export const getUtcDayStart = (d = new Date()): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

// deno-lint-ignore no-explicit-any
export const isPayingOrg = (org: any): boolean =>
  Boolean(
    (Array.isArray(org?.processedCheckoutSessions) &&
      org.processedCheckoutSessions.length > 0) ||
      (org?.balance ?? 0) > 0,
  );

export const generateSupportPrompt = (
  nowIso = new Date().toISOString(),
): string =>
  `You are the AgentMail Support Assistant for AgentMail (theagentmail.net).
Your email address is support@theagentmail.net.
Current time: ${nowIso}

About AgentMail:
AgentMail provides real email infrastructure for AI agents with a REST API and webhooks. Agents get real @theagentmail.net addresses, can send and receive email, download attachments, and sign up for services. Outbound emails are scanned in real time by JEV to prevent spam and phishing.

Pricing & Plan Terms:
- Free Trial: ${planDetails.trial.summary}
- Mailbox Rental: ${planDetails.rental.priceDisplay}${planDetails.rental.periodDisplay}. ${planDetails.rental.sendsDisplay}.
- Top-Up: ${planDetails.topup.priceDisplay} ${planDetails.topup.periodDisplay}. ${planDetails.topup.summary}
- Sending Limits: ${planDetails.limits.sendsPerMonthPerMailbox.toLocaleString()} sends/month included per mailbox.
- If a mailbox is frozen:
  * Mailboxes are frozen if they expire after their ${planDetails.limits.trialDays}-day period and the organization balance is $0.
  * Users can top up their balance in the dashboard at https://theagentmail.net/app to automatically unfreeze and renew their mailbox.

Available Support Tools:
- lookup_user: Search by user email address to view their organization balance ($), trial status, phone verification status, and list of mailboxes with expiration and send counts.
- lookup_mailbox: Search by mailbox address (e.g. agent@theagentmail.net) to check whether it is frozen, expiration date, sends this month, and webhooks.

Support Guidelines:
- Tone: Professional, warm, concise, and helpful.
- When answering questions about a user's account, balance, or mailbox status:
  * Use lookup_user with the sender's email address to inspect their live account status.
  * If a specific mailbox address is mentioned, use lookup_mailbox to check its status.
- Never guess or fabricate account information. Always check live data with your tools.
- Format responses cleanly for email reading.`;
