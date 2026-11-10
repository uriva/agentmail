# AgentMail

Open-source email infrastructure for AI agents (`@theagentmail.net`). Real mailboxes with sending, receiving, attachments, real-time webhooks, and AI spam/phishing filtering.

- **API & SDK Documentation**: [https://theagentmail.net/docs](https://theagentmail.net/docs) (source: [`web/src/docs.tsx`](web/src/docs.tsx))
- **Pricing & Limits**: [https://theagentmail.net/pricing](https://theagentmail.net/pricing) (source: [`src/planData.ts`](src/planData.ts))
- **TypeScript SDK**: [`sdk/`](sdk/)

## Architecture

- **Runtime & Hosting**: Deno locally, bundled to **Cloudflare Workers** (`wrangler.jsonc`) serving both `https://theagentmail.net` and `https://api.theagentmail.net`
- **Database**: InstantDB (`@instantdb/admin`)
- **Email provider**: Resend (outbound sending + inbound webhook at `POST /inbound`)
- **Spam & phishing protection**: Real-time outbound and inbound classification (`src/services/jev.ts`)
- **Billing & verification**: Stripe (prepaid balance checkout) and Twilio Verify (trial phone verification)
- **File storage**: Google Cloud Storage (`agentmail-attachments`)
- **Frontend**: Preact + Vite (`web/`)
- **Analytics**: PostHog

## Setup

Configure `.env` with the required credentials:

| Variable                     | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `INSTANT_APP_ID`             | InstantDB app ID (`VITE_INSTANT_APP_ID` for frontend)         |
| `INSTANT_ADMIN_TOKEN`        | InstantDB admin token                                         |
| `RESEND_API_KEY`             | Resend API key for sending and fetching inbound emails        |
| `INBOUND_WEBHOOK_SECRET`     | Resend inbound webhook Svix secret                            |
| `EMAIL_DOMAIN`               | Domain for mailboxes (default: `theagentmail.net`)            |
| `GCP_PROJECT`                | Google Cloud project ID                                       |
| `GCP_STORAGE_BUCKET`         | GCS bucket for attachments (default: `agentmail-attachments`) |
| `GCP_SERVICE_ACCOUNT_KEY`    | GCP service account key JSON                                  |
| `STRIPE_SECRET_KEY`          | Stripe secret key for balance top-ups                         |
| `STRIPE_WEBHOOK_SECRET`      | Stripe webhook signing secret                                 |
| `TWILIO_ACCOUNT_SID`         | Twilio account SID for phone verification                     |
| `TWILIO_AUTH_TOKEN`          | Twilio auth token (or `TWILIO_API_KEY_SID` / `SECRET`)        |
| `TWILIO_VERIFY_SERVICE_SID`  | Twilio Verify service SID                                     |
| `RESPAN_API_KEY`             | API key for real-time spam/phishing classification            |
| `POSTHOG_API_KEY`            | PostHog API key (`VITE_POSTHOG_KEY` for frontend)             |

## Development & Deployment

```bash
deno task dev           # Run API server locally on :8000 with watch mode
deno task dev:web       # Run frontend dev server
deno task check         # Type-check server and SDK
deno task build:web     # Build static frontend into web/dist
deno task build:worker  # Bundle Cloudflare Worker into dist/worker.js
deno task deploy        # Deploy worker + static assets via wrangler
```
