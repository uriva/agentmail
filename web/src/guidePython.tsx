import { useAuth } from "./db.ts";

const plainPython = `import os
import requests

API = "https://api.theagentmail.net"
HEADERS = {"Authorization": f"Bearer {os.environ['AGENTMAIL_KEY']}"}

# Send an email from the agent's mailbox
requests.post(
    f"{API}/v1/messages",
    headers=HEADERS,
    json={
        "to": ["human@example.com"],
        "subject": "Weekly summary ready",
        "text": "All 14 jobs succeeded. Reply to this email to trigger a rerun.",
    },
    timeout=15,
).raise_for_status()

# Read recent inbound and outbound messages (newest first)
messages = requests.get(f"{API}/v1/messages", headers=HEADERS, timeout=15).json()["data"]
latest = messages[0]
detail = requests.get(
    f"{API}/v1/messages/{latest['id']}",
    headers=HEADERS,
    timeout=15,
).json()["data"]
print(detail["from"], detail["subject"], detail["bodyText"])`;

const langgraphTools = `import os
import requests
from langchain_core.tools import tool

API = "https://api.theagentmail.net"
HEADERS = {"Authorization": f"Bearer {os.environ['AGENTMAIL_KEY']}"}

@tool
def check_inbox(limit: int = 10) -> list[dict]:
    """List recent emails in the agent's AgentMail inbox."""
    res = requests.get(f"{API}/v1/messages", headers=HEADERS, timeout=15)
    res.raise_for_status()
    return res.json()["data"][:limit]

@tool
def read_email(message_id: str) -> dict:
    """Read the full text, headers, and attachments of a single email."""
    res = requests.get(f"{API}/v1/messages/{message_id}", headers=HEADERS, timeout=15)
    res.raise_for_status()
    return res.json()["data"]

@tool
def send_email(to: list[str], subject: str, text: str, in_reply_to: str = "") -> dict:
    """Send an email from the agent's inbox (optional in_reply_to keeps the thread)."""
    payload = {"to": to, "subject": subject, "text": text}
    if in_reply_to:
        payload["inReplyTo"] = in_reply_to
        payload["references"] = in_reply_to
    res = requests.post(f"{API}/v1/messages", headers=HEADERS, json=payload, timeout=15)
    res.raise_for_status()
    return res.json()["data"]`;

const webhookFastApi = `import hashlib
import hmac
import os
import time
from fastapi import FastAPI, HTTPException, Request

app = FastAPI()
WEBHOOK_SECRET = os.environ["AGENTMAIL_WEBHOOK_SECRET"]

@app.post("/agentmail/webhook")
async def on_email(request: Request):
    raw_body = (await request.body()).decode("utf-8")
    ts = request.headers.get("X-AgentMail-Timestamp", "")
    sig = request.headers.get("X-AgentMail-Signature-256", "")

    if not ts.isdigit() or abs(int(time.time() * 1000) - int(ts)) > 300_000:
        raise HTTPException(status_code=401, detail="Stale timestamp")

    expected = "v1=" + hmac.new(
        WEBHOOK_SECRET.encode(),
        f"{ts}.{raw_body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = await request.json()
    msg = event["data"]
    print(f"New mail for {msg['account_address']} from {msg['from']}: {msg['subject']}")
    return {"ok": True}`;

export const GuidePython = () => {
  const { user } = useAuth();
  const ctaHref = user ? "/app" : "/login";

  return (
    <div class="max-w-3xl mx-auto py-6">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-blue-400 mb-3">
        Python, LangGraph &amp; CrewAI Guide
      </p>
      <h1 class="display-serif text-4xl sm:text-5xl text-white mb-4">
        Give a Python AI agent its own email inbox.
      </h1>
      <p class="text-slate-400 text-lg leading-relaxed mb-8">
        No Gmail OAuth refresh-token headaches, no SMTP/IMAP boilerplate, and no
        proprietary wrapper SDK required. Use plain{" "}
        <span class="font-mono text-slate-200">requests</span> with an
        account-scoped{" "}
        <span class="font-mono text-slate-200">am_...</span> API key to send,
        read, thread replies, and handle signed webhooks in Python, LangGraph,
        OpenAI Agents, or CrewAI.
      </p>

      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-8 space-y-4">
        <h2 class="text-lg font-semibold text-white">
          1. Send and read mail with plain Python requests
        </h2>
        <p class="text-slate-400 text-sm">
          Create a free 30-day{" "}
          <span class="font-mono text-slate-200">@theagentmail.net</span>{" "}
          mailbox at{" "}
          <a href={ctaHref} class="text-blue-400 hover:text-blue-300 underline">
            theagentmail.net/app
          </a>
          , generate an account-scoped API key, and export{" "}
          <code class="text-slate-200">AGENTMAIL_KEY</code>:
        </p>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{plainPython}</code>
        </pre>
      </div>

      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-8 space-y-4">
        <h2 class="text-lg font-semibold text-white">
          2. Drop-in LangChain / LangGraph tools
        </h2>
        <p class="text-slate-400 text-sm">
          Because the API key is scoped to a single mailbox, your agent cannot
          access neighboring inboxes or billing routes even if an inbound email
          contains a prompt injection.
        </p>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{langgraphTools}</code>
        </pre>
      </div>

      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-8 space-y-4">
        <h2 class="text-lg font-semibold text-white">
          3. Wake your agent in real time with HMAC-signed webhooks (FastAPI)
        </h2>
        <p class="text-slate-400 text-sm">
          Instead of polling every minute, register a webhook URL via{" "}
          <code class="text-slate-200">POST /v1/webhooks</code> (or in the
          dashboard) and verify{" "}
          <code class="text-slate-200">X-AgentMail-Signature-256</code> on
          arrival:
        </p>
        <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-slate-200 font-mono">
          <code>{webhookFastApi}</code>
        </pre>
      </div>

      <div class="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 mb-10">
        <h2 class="text-lg font-semibold text-white mb-2">
          Transparent pricing, MIT open source
        </h2>
        <p class="text-slate-400 text-sm leading-relaxed">
          Your first mailbox is free for 30 days (no card required). Additional
          or continuing mailboxes are a flat{" "}
          <span class="text-white font-medium">$1/month</span> from a $5 prepaid
          deposit that never expires (which also unlocks inbound OTP/signup
          verification emails and 1,000 sends/mo). Or self-host the entire
          Cloudflare Workers stack under MIT.
        </p>
      </div>

      <div class="flex flex-wrap gap-3">
        <a
          href={ctaHref}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Create a free inbox →
        </a>
        <a
          href="/guides/mcp"
          class="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-200 rounded-lg transition-colors"
        >
          Remote MCP guide
        </a>
        <a
          href="/compare"
          class="px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-lg transition-colors"
        >
          Compare vs agentmail.to
        </a>
      </div>
    </div>
  );
};
