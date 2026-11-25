# AgentMail (`theagentmail.net`)

Open-source (MIT) email infrastructure for AI agents. Give every agent its own
`@theagentmail.net` mailbox with sending, receiving, real-time webhooks,
attachments, and a real-time AI spam/phishing guard — **$1/month per mailbox**
(first mailbox free for 30 days) or self-host on Cloudflare Workers.

- **Hosted app**: [https://theagentmail.net](https://theagentmail.net)
- **API Docs**: [https://theagentmail.net/docs](https://theagentmail.net/docs)
- **LLM / Agent Docs**:
  [https://theagentmail.net/llms.txt](https://theagentmail.net/llms.txt)
- **Pricing**:
  [https://theagentmail.net/pricing](https://theagentmail.net/pricing)
- **Comparison vs agentmail.to & DIY**:
  [https://theagentmail.net/compare](https://theagentmail.net/compare)

## Why AgentMail?

| Feature | AgentMail (`theagentmail.net`) | `agentmail.to` | DIY (Gmail / own domain) |
| --- | --- | --- | --- |
| License | **100% Open Source (MIT)** | Closed source | Varies |
| Self-hostable | **Yes (Cloudflare Workers)** | No | Manual DNS + SMTP/IMAP |
| Pricing | **$1/mo per mailbox** ($5 prepaid, never expires) | $200/mo Startup (150 inboxes) + $2/extra | Domain + email host + warmup |
| Outbound spam guard | **Real-time AI spam & phishing filter** | Account-level | None |
| Agent integration | REST API, webhooks, `/llms.txt`, OpenCode skill | SDK + REST API | IMAP/SMTP boilerplate |

## 30-Second Quickstart

Create a mailbox with your org key (from
[theagentmail.net/app](https://theagentmail.net/app)):

```bash
curl -X POST https://api.theagentmail.net/v1/accounts \
  -H "Authorization: Bearer $AGENTMAIL_ORG_KEY" \
  -H "Content-Type: application/json" \
  -d '{"address": "deploy-bot"}'
```

Send an email with a scoped account key (zero dependencies):

```typescript
await fetch("https://api.theagentmail.net/v1/messages", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.AGENTMAIL_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: ["you@company.com"],
    subject: "Deploy succeeded",
    text: "All checks green.",
  }),
});
```

Or hand any coding agent (Claude Code, OpenCode, Cursor, OpenClaw) your scoped
key and `https://theagentmail.net/llms.txt` — it can read the entire spec and
wire up sending, inbox polling, and signed webhooks automatically.

## Architecture

- **Runtime & Hosting**: Deno locally, bundled to **Cloudflare Workers**
  (`wrangler.jsonc`) serving both `https://theagentmail.net` and
  `https://api.theagentmail.net`
- **Database**: InstantDB (`@instantdb/admin`)
- **Email provider**: Resend (outbound sending + inbound webhook at
  `POST /inbound`)
- **Spam & phishing protection**: Real-time outbound and inbound classification
  (`src/services/emailGuard.ts`)
- **Billing & verification**: Stripe (prepaid balance checkout) and Twilio
  Verify (trial phone verification)
- **File storage**: Google Cloud Storage (`agentmail-attachments`)
- **Frontend**: Preact + Vite (`web/`)
- **TypeScript SDK**: [`sdk/`](sdk/)
- **Analytics**: PostHog

## Self-Hosting Setup

Configure `.env` with the required credentials:

| Variable                    | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `INSTANT_APP_ID`            | InstantDB app ID (`VITE_INSTANT_APP_ID` for frontend)         |
| `INSTANT_ADMIN_TOKEN`       | InstantDB admin token                                         |
| `RESEND_API_KEY`            | Resend API key for sending and fetching inbound emails        |
| `INBOUND_WEBHOOK_SECRET`    | Resend inbound webhook Svix secret                            |
| `EMAIL_DOMAIN`              | Domain for mailboxes (default: `theagentmail.net`)            |
| `GCP_PROJECT`               | Google Cloud project ID                                       |
| `GCP_STORAGE_BUCKET`        | GCS bucket for attachments (default: `agentmail-attachments`) |
| `GCP_SERVICE_ACCOUNT_KEY`   | GCP service account key JSON                                  |
| `STRIPE_SECRET_KEY`         | Stripe secret key for balance top-ups                         |
| `STRIPE_WEBHOOK_SECRET`     | Stripe webhook signing secret                                 |
| `TWILIO_ACCOUNT_SID`        | Twilio account SID for phone verification                     |
| `TWILIO_AUTH_TOKEN`         | Twilio auth token (or `TWILIO_API_KEY_SID` / `SECRET`)        |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service SID                                     |
| `GEMINI_API_KEY`            | Gemini API key for real-time spam/phishing classification     |
| `POSTHOG_API_KEY`           | PostHog API key (`VITE_POSTHOG_KEY` for frontend)             |

## Development & Deployment

```bash
deno task dev           # Run API server locally on :8000 with watch mode
deno task dev:web       # Run frontend dev server
deno task check         # Type-check server and SDK
deno task test          # Run test suite
deno task build:web     # Build & prerender static frontend into web/dist
deno task build:worker  # Bundle Cloudflare Worker into dist/worker.js
deno task deploy        # Deploy worker + static assets via wrangler
```

## License

MIT
