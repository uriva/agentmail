"""AgentMail (theagentmail.net) plugin for Hermes Agent."""

from __future__ import annotations

from . import schemas, tools

TOOLSET = "theagentmail"

_TOOLS = (
    (schemas.GET_MAILBOX, tools.get_mailbox),
    (schemas.LIST_MESSAGES, tools.list_messages),
    (schemas.GET_MESSAGE, tools.get_message),
    (schemas.SEND_EMAIL, tools.send_email),
    (schemas.GET_ATTACHMENT_URL, tools.get_attachment_url),
    (schemas.LIST_WEBHOOKS, tools.list_webhooks),
    (schemas.CREATE_WEBHOOK, tools.create_webhook),
    (schemas.DELETE_WEBHOOK, tools.delete_webhook),
)


def _require_webhook_approval(tool_name: str = "", args: dict | None = None, **kwargs):
    if tool_name != "theagentmail_create_webhook":
        return None
    url = args.get("url") if isinstance(args, dict) else None
    target = url.strip() if isinstance(url, str) and url.strip() else "<missing url>"
    return {
        "action": "approve",
        "message": (
            f"Register persistent AgentMail inbound email webhook to {target}? "
            "Future emails sent to this inbox will be forwarded to this URL even after this session ends."
        ),
    }


def register(ctx) -> None:
    for schema, handler in _TOOLS:
        ctx.register_tool(
            name=schema["name"],
            toolset=TOOLSET,
            schema=schema,
            handler=handler,
            check_fn=tools.is_configured,
            emoji="✉️",
        )
    ctx.register_hook("pre_tool_call", _require_webhook_approval)
