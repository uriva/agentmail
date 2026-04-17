# AgentMail

Email infrastructure for AI agents. Create email accounts on `theagentmail.net`,
send and receive messages, and get real-time notifications via webhooks.

## Architecture

- **Runtime**: Deno, deployed to Deno Deploy (auto-deploys on push to main)
- **Database**: InstantDB (`@instantdb/admin`)
- **Email provider**: Forward Email (forwardemail.net) for sending and receiving
- **Domain**: `theagentmail.net`
- **File storage**: Google Cloud Storage (bucket `agentmail-attachments`)
- **Frontend**: Preact + Vite, served as static files from `web/dist/`
- **Analytics**: PostHog

## Setup

Copy `.env.example` to `.env` and fill in the values:

| Variable                  | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `INSTANT_APP_ID`          | InstantDB app ID                                              |
| `INSTANT_ADMIN_TOKEN`     | InstantDB admin token                                         |
| `VITE_INSTANT_APP_ID`     | Same app ID, exposed to the frontend                          |
| `FORWARD_EMAIL_API_KEY`   | Forward Email API key                                         |
| `FORWARD_EMAIL_DOMAIN`    | Domain for email accounts (default: `theagentmail.net`)       |
| `GCP_PROJECT_ID`          | Google Cloud project ID                                       |
| `GCP_STORAGE_BUCKET`      | GCS bucket for attachments (default: `agentmail-attachments`) |
| `GCP_SERVICE_ACCOUNT_KEY` | GCP service account key JSON                                  |
| `POSTHOG_API_KEY`         | PostHog API key                                               |
| `POSTHOG_HOST`            | PostHog ingest URL                                            |
| `INBOUND_WEBHOOK_SECRET`  | Forward Email webhook signature key (from domain settings)    |

```bash
deno task dev        # Run server with watch mode
deno task dev:web    # Run frontend dev server
deno task build:web  # Build frontend for production
deno task check      # Type-check server and SDK
```

## Authentication

Two auth mechanisms:

1. **API key** (`Bearer am_...`): For programmatic access. Keys are SHA-256
   hashed and stored in InstantDB. Can be org-scoped or account-scoped.
   Account-scoped keys can only access their own account and use the shortcut
   routes (`/v1/messages`, `/v1/webhooks`, etc.).

2. **User token** (`Bearer <instant_token>`): For the dashboard frontend. Uses
   InstantDB auth verification. Requires `X-Org-Id` header for org-scoped
   operations.

## API

Base URL: `https://api.theagentmail.net`

All responses are wrapped in `{ "data": ... }`. Errors return
`{ "error": "...", "code": "..." }`.

### Accounts

| Method   | Path                      | Auth                    | Description        |
| -------- | ------------------------- | ----------------------- | ------------------ |
| `POST`   | `/v1/accounts`            | apiKey or userToken     | Create account     |
| `GET`    | `/v1/accounts`            | apiKey or userToken     | List accounts      |
| `GET`    | `/v1/accounts/:accountId` | apiKey or userToken     | Get account        |
| `DELETE` | `/v1/accounts/:accountId` | apiKey or userToken     | Delete account     |
| `GET`    | `/v1/account`             | apiKey (account-scoped) | Get own account    |
| `DELETE` | `/v1/account`             | apiKey (account-scoped) | Delete own account |

**Create account** body:

```json
{ "address": "mybot", "displayName": "My Bot" }
```

The address is the local part only. A Forward Email alias is created
automatically, pointing inbound mail to the AgentMail inbound webhook.

### Messages

| Method | Path                                          | Auth                    | Description              |
| ------ | --------------------------------------------- | ----------------------- | ------------------------ |
| `POST` | `/v1/accounts/:accountId/messages`            | apiKey or userToken     | Send message             |
| `GET`  | `/v1/accounts/:accountId/messages`            | apiKey or userToken     | List messages            |
| `GET`  | `/v1/accounts/:accountId/messages/:messageId` | apiKey or userToken     | Get message              |
| `POST` | `/v1/messages`                                | apiKey (account-scoped) | Send message (shortcut)  |
| `GET`  | `/v1/messages`                                | apiKey (account-scoped) | List messages (shortcut) |
| `GET`  | `/v1/messages/:messageId`                     | apiKey (account-scoped) | Get message (shortcut)   |

**Send message** body:

```json
{
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",
  "inReplyTo": "<message-id@example.com>",
  "references": "<message-id@example.com>",
  "attachments": [
    {
      "filename": "doc.pdf",
      "contentType": "application/pdf",
      "content": "<base64-encoded>"
    }
  ]
}
```

Only `to` and `subject` are required. Use `inReplyTo` and `references` for
threading replies.

### Webhooks

| Method   | Path                                          | Auth                    | Description               |
| -------- | --------------------------------------------- | ----------------------- | ------------------------- |
| `POST`   | `/v1/accounts/:accountId/webhooks`            | apiKey or userToken     | Create webhook            |
| `GET`    | `/v1/accounts/:accountId/webhooks`            | apiKey or userToken     | List webhooks             |
| `DELETE` | `/v1/accounts/:accountId/webhooks/:webhookId` | apiKey or userToken     | Delete webhook            |
| `POST`   | `/v1/webhooks`                                | apiKey (account-scoped) | Create webhook (shortcut) |
| `GET`    | `/v1/webhooks`                                | apiKey (account-scoped) | List webhooks (shortcut)  |
| `DELETE` | `/v1/webhooks/:webhookId`                     | apiKey (account-scoped) | Delete webhook (shortcut) |

**Create webhook** body:

```json
{ "url": "https://example.com/webhook", "secret": "optional-secret" }
```

If `secret` is omitted, a random 32-byte hex secret is generated and returned.

**Webhook delivery payload** (sent as POST to your URL):

```json
{
  "event": "email.received",
  "data": {
    "id": "<message-id>",
    "account_id": "<account-id>",
    "from": "sender@example.com",
    "to": ["yourbot@theagentmail.net"],
    "subject": "Hello",
    "text": "Plain text body",
    "html": "<p>HTML body</p>",
    "inReplyTo": "",
    "references": "",
    "attachments": [
      {
        "id": "<attachment-id>",
        "filename": "doc.pdf",
        "contentType": "application/pdf",
        "size": 12345
      }
    ]
  },
  "timestamp": 1709300000000
}
```

Webhook deliveries include two headers:

- `X-AgentMail-Signature` — HMAC-SHA256 hex digest of the request body, signed
  with your webhook secret
- `X-AgentMail-Timestamp` — millisecond timestamp of when the delivery was sent

Verify the signature and reject requests with timestamps older than 5 minutes to
prevent replay attacks.

### Attachments

| Method | Path                                                                    | Auth                    | Description                   |
| ------ | ----------------------------------------------------------------------- | ----------------------- | ----------------------------- |
| `GET`  | `/v1/accounts/:accountId/messages/:messageId/attachments/:attachmentId` | apiKey or userToken     | Get attachment URL            |
| `GET`  | `/v1/messages/:messageId/attachments/:attachmentId`                     | apiKey (account-scoped) | Get attachment URL (shortcut) |

### API Keys

| Method   | Path                               | Auth                | Description                   |
| -------- | ---------------------------------- | ------------------- | ----------------------------- |
| `POST`   | `/v1/api-keys`                     | userToken           | Create API key                |
| `GET`    | `/v1/api-keys`                     | userToken           | List API keys                 |
| `DELETE` | `/v1/api-keys/:apiKeyId`           | userToken           | Delete API key                |
| `POST`   | `/v1/accounts/:accountId/api-keys` | apiKey or userToken | Create account-scoped API key |

### Organizations

| Method  | Path                | Auth      | Description         |
| ------- | ------------------- | --------- | ------------------- |
| `POST`  | `/v1/organizations` | userToken | Create organization |
| `GET`   | `/v1/organizations` | userToken | List organizations  |
| `PATCH` | `/v1/organizations` | userToken | Rename organization |

### Members

| Method   | Path                    | Auth      | Description   |
| -------- | ----------------------- | --------- | ------------- |
| `POST`   | `/v1/members`           | userToken | Invite member |
| `GET`    | `/v1/members`           | userToken | List members  |
| `DELETE` | `/v1/members/:memberId` | userToken | Remove member |

### Karma

| Method | Path        | Auth                | Description       |
| ------ | ----------- | ------------------- | ----------------- |
| `GET`  | `/v1/karma` | apiKey or userToken | Get karma balance |

Karma is earned by receiving emails from trusted domains (gmail, outlook, etc.)
and spent on sending emails and creating accounts.

### Health

| Method | Path      | Auth | Description  |
| ------ | --------- | ---- | ------------ |
| `GET`  | `/health` | none | Health check |

## Inbound email flow

1. Forward Email receives mail for `*@theagentmail.net`
2. Forward Email POSTs the parsed email to `POST /inbound` (webhook alias)
3. AgentMail verifies the webhook signature (`INBOUND_WEBHOOK_SECRET`)
4. Normalizes the mailparser payload (handles structured address objects,
   Buffer-style attachments, `html: false` for missing HTML, etc.)
5. Looks up the recipient account in InstantDB
6. Stores the message and any attachments (GCS)
7. Awards karma if the sender is from a trusted domain and no unanswered inbound
   exists from this sender
8. Fires webhook delivery to all active webhook subscriptions for the account

## Deployment

Deployed to Deno Deploy via CI/CD (GitHub integration). Pushing to `main`
triggers automatic deployment. Do not run `deno deploy` locally.

The build step (`deno task build:web`) runs before deployment to produce the
frontend bundle.
