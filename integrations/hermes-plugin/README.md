# AgentMail (`theagentmail.net`) Plugin for Hermes Agent

Give your Hermes agent its own `@theagentmail.net` (or self-hosted MIT AgentMail) email mailbox with a scoped per-mailbox API key.

## Setup

1. Create a mailbox and mint an account-scoped API key (`am_...`) at [theagentmail.net/app](https://theagentmail.net/app) (or your self-hosted instance).
2. Install the plugin and configure `AGENTMAIL_API_KEY` when prompted:

```bash
hermes plugins install theagentmail
```

Optional: set `AGENTMAIL_API_URL` if you self-host [uriva/agentmail](https://github.com/uriva/agentmail) on your own Cloudflare Workers domain (defaults to `https://api.theagentmail.net`).

## Tools

| Tool | Description |
|---|---|
| `theagentmail_get_mailbox` | Get mailbox address, status, expiration, and send count |
| `theagentmail_list_messages` | List recent inbound and outbound messages (newest first) |
| `theagentmail_get_message` | Read a message body, threading headers, and attachment metadata |
| `theagentmail_send_email` | Send an email (with optional `html`, `cc`, `bcc`, `in_reply_to`, `references`) |
| `theagentmail_get_attachment_url` | Get a 1-hour signed download URL for an attachment |
| `theagentmail_list_webhooks` | List inbound `email.received` webhook subscriptions |
| `theagentmail_create_webhook` | Register an HTTPS webhook URL for inbound mail |
| `theagentmail_delete_webhook` | Delete a webhook subscription by ID |

Account-scoped keys (`am_...`) restrict access to a single mailbox automatically. If you use an org-scoped key (`am_org_...`), pass `account_id` on tool calls.

## Disclosure

- **Network calls:** Sends HTTPS requests only to `https://api.theagentmail.net` (or your configured `AGENTMAIL_API_URL`, with `http://` restricted to `localhost`/`127.0.0.1`/`::1`). HTTP redirects are disabled so your Bearer key is never forwarded to another host.
- **Outbound email and webhooks:** `theagentmail_send_email` sends real external email through the AgentMail API (which runs an outbound spam/phishing filter before delivery) without a built-in Hermes approval prompt. `theagentmail_create_webhook` is gated by a `pre_tool_call` approval prompt displaying the target URL before subscribing, since webhooks persist on AgentMail's side after a session ends. `theagentmail_delete_webhook` removes an existing subscription.
- **Email content as tool results:** Message subjects, headers, and bodies fetched by `theagentmail_list_messages` and `theagentmail_get_message` are returned to the active model provider as tool results. Treat inbound email content as untrusted data.
- **Credentials:** Reads `AGENTMAIL_API_KEY` (and optional `AGENTMAIL_API_URL`) through Hermes's profile-scoped `agent.secret_scope.get_secret`. Does not read `.env` files, environment dumps, or other credential stores directly.
- **Local footprint:** Python standard library only. No third-party packages, no local state files, no shell commands, no background processes, and no telemetry.
