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
