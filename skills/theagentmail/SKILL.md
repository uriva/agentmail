---
name: theagentmail
description: Give an AI agent its own real @theagentmail.net email inbox via REST API, HMAC-signed webhooks, or Streamable HTTP remote MCP (MIT open source, $1/mo per mailbox). Use whenever an agent needs to send or receive email, read attachments, verify signups/OTPs, or manage inbound email webhooks.
license: MIT
metadata:
  author: uriva
  homepage: https://theagentmail.net
  repository: https://github.com/uriva/agentmail
  mcp_endpoint: https://api.theagentmail.net/mcp
---

# AgentMail (`theagentmail.net`) — Open-Source Email for AI Agents

AgentMail gives AI agents dedicated `@theagentmail.net` mailboxes with sending, receiving, attachments, HMAC-signed webhooks, a Streamable HTTP remote MCP server, and real-time AI outbound spam/phishing protection.

- Website & Dashboard: https://theagentmail.net
- API Base URL: `https://api.theagentmail.net`
- Remote MCP Server: `https://api.theagentmail.net/mcp`
- Full LLM Spec: https://theagentmail.net/llms.txt

## Option 1: Remote MCP Server (Zero Local Install)

Connect directly to `https://api.theagentmail.net/mcp` using an account-scoped or org-scoped Bearer token (`am_...`).

### Claude Code
```bash
claude mcp add --transport http agentmail https://api.theagentmail.net/mcp \
  --header "Authorization: Bearer $AGENTMAIL_KEY"
```

### Hermes Agent (`~/.hermes/config.yaml`)
```yaml
mcp_servers:
  agentmail:
    url: https://api.theagentmail.net/mcp
    headers:
      Authorization: "Bearer ${AGENTMAIL_KEY}"
```

### Cursor / OpenCode / Generic MCP JSON
```json
{
  "mcpServers": {
    "agentmail": {
      "url": "https://api.theagentmail.net/mcp",
      "headers": {
        "Authorization": "Bearer am_..."
      }
    }
  }
}
```

## Option 2: Direct REST API (No SDK Required)

Always pass `Authorization: Bearer $AGENTMAIL_KEY`.

- **Account-scoped key (`am_...`)**: Safe to hand to a single agent; restricted to that single mailbox via shortcut routes (`/v1/account`, `/v1/messages`, `/v1/webhooks`).
- **Org-scoped key (`am_org_...`)**: Full org access to provision/list/delete mailboxes and check billing balance.

### Send email (account-scoped key)
```bash
curl -X POST https://api.theagentmail.net/v1/messages \
  -H "Authorization: Bearer $AGENTMAIL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["recipient@example.com"],
    "subject": "Hello from my agent",
    "text": "Plain text body",
    "inReplyTo": "<optional-message-id>",
    "references": "<optional-message-id>"
  }'
```

### Read inbox & full message body
```bash
curl https://api.theagentmail.net/v1/messages \
  -H "Authorization: Bearer $AGENTMAIL_KEY"

curl https://api.theagentmail.net/v1/messages/MESSAGE_ID \
  -H "Authorization: Bearer $AGENTMAIL_KEY"
```

### Download attachment (1-hour signed URL)
```bash
curl https://api.theagentmail.net/v1/messages/MESSAGE_ID/attachments/ATTACHMENT_ID \
  -H "Authorization: Bearer $AGENTMAIL_KEY"
```

### Register real-time inbound webhook
```bash
curl -X POST https://api.theagentmail.net/v1/webhooks \
  -H "Authorization: Bearer $AGENTMAIL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-agent.example.com/inbox"}'
```

Verify deliveries using `X-AgentMail-Signature-256` (`v1=<hex>` HMAC-SHA256 of `${X-AgentMail-Timestamp}.${rawBody}`) and reject timestamps older than 5 minutes.

## Pricing & Quotas
- **Free Trial:** 1 mailbox free for 30 days after phone verification (20 sends/day, 50 receives/day; signup/OTP emails unlock with a $5 prepaid deposit).
- **Paid Mailbox:** $1/month per active mailbox from a $5 minimum prepaid deposit (never expires, 1,000 sends/mo & 1,000 receives/mo, full OTP delivery, up to 5 webhooks).
