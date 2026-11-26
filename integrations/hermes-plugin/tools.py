"""AgentMail (theagentmail.net) REST API client and Hermes tool handlers.

Calls only fixed AgentMail /v1 mailbox, message, attachment, and webhook endpoints
on https://api.theagentmail.net (or an explicitly configured AGENTMAIL_API_URL).
Does not follow HTTP redirects so Bearer tokens are never sent to another origin.
Uses Python standard library only; no local files, no background tasks, no telemetry.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, List, Optional

from agent.secret_scope import get_secret

DEFAULT_API_URL = "https://api.theagentmail.net"
TIMEOUT_SECONDS = 20
MAX_ERROR_DETAIL = 300
DEFAULT_LIST_LIMIT = 20
MAX_LIST_LIMIT = 100

_HOST_PATTERN = re.compile(r"^[A-Za-z0-9._:%-]+$")
_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


class AgentMailError(Exception):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise AgentMailError(f"AgentMail API returned unexpected HTTP {code} redirect; redirects are disabled.")


_OPENER = urllib.request.build_opener(_NoRedirect)


def is_configured() -> bool:
    return bool((get_secret("AGENTMAIL_API_KEY", "") or "").strip())


def _api_key() -> str:
    key = (get_secret("AGENTMAIL_API_KEY", "") or "").strip()
    if not key:
        raise AgentMailError(
            "AGENTMAIL_API_KEY is not set. Create a scoped mailbox API key at https://theagentmail.net/app."
        )
    return key


def _base_url() -> str:
    raw = (get_secret("AGENTMAIL_API_URL", "") or "").strip().rstrip("/")
    if not raw:
        return DEFAULT_API_URL
    try:
        parsed = urllib.parse.urlsplit(raw)
        parsed.port
    except ValueError:
        raise AgentMailError("AGENTMAIL_API_URL is not a valid URL.") from None
    if "@" in parsed.netloc:
        raise AgentMailError("AGENTMAIL_API_URL must not contain userinfo credentials.")
    host = (parsed.hostname or "").lower()
    if not host or not _HOST_PATTERN.fullmatch(host):
        raise AgentMailError("AGENTMAIL_API_URL must have a valid hostname.")
    if parsed.scheme == "http" and host not in _LOCAL_HOSTS:
        raise AgentMailError("AGENTMAIL_API_URL must use https:// (http:// is allowed only for localhost).")
    if parsed.scheme not in ("https", "http"):
        raise AgentMailError("AGENTMAIL_API_URL must use https://.")
    if parsed.query or parsed.fragment:
        raise AgentMailError("AGENTMAIL_API_URL must not include query parameters or fragments.")
    path = parsed.path.rstrip("/")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def _validate_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AgentMailError(f"{label} must be a non-empty string.")
    cleaned = value.strip()
    if "/" in cleaned or "\\" in cleaned or ".." in cleaned or any(ord(c) < 32 for c in cleaned):
        raise AgentMailError(f"{label} contains invalid characters.")
    return urllib.parse.quote(cleaned, safe="")


def _account_prefix(args: Dict[str, Any]) -> str:
    raw = args.get("account_id")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return "/v1"
    return f"/v1/accounts/{_validate_id(raw, 'account_id')}"


def _mailbox_path(args: Dict[str, Any]) -> str:
    raw = args.get("account_id")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return "/v1/account"
    return f"/v1/accounts/{_validate_id(raw, 'account_id')}"


def _validate_email_list(value: Any, label: str, required: bool) -> Optional[List[str]]:
    if value is None:
        if required:
            raise AgentMailError(f"{label} must be a non-empty list of email addresses.")
        return None
    if not isinstance(value, list) or not all(isinstance(x, str) and x.strip() for x in value):
        raise AgentMailError(f"{label} must be a list of non-empty email address strings.")
    cleaned = [x.strip() for x in value]
    if required and not cleaned:
        raise AgentMailError(f"{label} must contain at least one recipient email address.")
    return cleaned


def _validate_webhook_url(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AgentMailError("url must be a non-empty HTTPS URL.")
    raw = value.strip()
    try:
        parsed = urllib.parse.urlsplit(raw)
        parsed.port
    except ValueError:
        raise AgentMailError("url is not a valid HTTPS URL.") from None
    if parsed.scheme != "https" or not parsed.hostname or "@" in parsed.netloc:
        raise AgentMailError("url must be a valid https:// URL without embedded credentials.")
    return raw


def _request(method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
    url = f"{_base_url()}{path}"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {_api_key()}",
        "User-Agent": "hermes-theagentmail/0.1.1",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with _OPENER.open(req, timeout=TIMEOUT_SECONDS) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            err_body = exc.read().decode("utf-8", errors="replace")
            parsed_err = json.loads(err_body)
            if isinstance(parsed_err, dict):
                msg = parsed_err.get("error") or parsed_err.get("message") or ""
                code = parsed_err.get("code") or ""
                detail = f"{code}: {msg}".strip(": ") if (code or msg) else err_body[:MAX_ERROR_DETAIL]
            else:
                detail = err_body[:MAX_ERROR_DETAIL]
        except Exception:
            detail = exc.reason if isinstance(exc.reason, str) else ""
        raise AgentMailError(f"HTTP {exc.code}: {detail[:MAX_ERROR_DETAIL]}".strip()) from None
    except urllib.error.URLError as exc:
        raise AgentMailError(f"Network error contacting AgentMail API: {exc.reason}") from None
    except TimeoutError:
        raise AgentMailError("Request to AgentMail API timed out.") from None

    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise AgentMailError("AgentMail API returned invalid JSON.") from None
    return parsed.get("data", parsed) if isinstance(parsed, dict) else parsed


def _ok(**payload: Any) -> str:
    return json.dumps({"ok": True, **payload}, ensure_ascii=False)


def _run(fn: Callable[[Dict[str, Any]], str], args: Any) -> str:
    safe_args = args if isinstance(args, dict) else {}
    try:
        return fn(safe_args)
    except AgentMailError as exc:
        return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)


def _get_mailbox(args: Dict[str, Any]) -> str:
    return _ok(mailbox=_request("GET", _mailbox_path(args)))


def _list_messages(args: Dict[str, Any]) -> str:
    raw_limit = args.get("limit", DEFAULT_LIST_LIMIT)
    if isinstance(raw_limit, bool) or not isinstance(raw_limit, int) or raw_limit < 1:
        raise AgentMailError("limit must be a positive integer.")
    limit = min(raw_limit, MAX_LIST_LIMIT)
    messages = _request("GET", f"{_account_prefix(args)}/messages")
    if isinstance(messages, list):
        total = len(messages)
        return _ok(messages=messages[:limit], returned=min(total, limit), total=total)
    return _ok(messages=messages)


def _get_message(args: Dict[str, Any]) -> str:
    message_id = _validate_id(args.get("message_id"), "message_id")
    return _ok(message=_request("GET", f"{_account_prefix(args)}/messages/{message_id}"))


def _send_email(args: Dict[str, Any]) -> str:
    to = _validate_email_list(args.get("to"), "to", required=True)
    subject = args.get("subject")
    text = args.get("text")
    if not isinstance(subject, str) or not subject.strip():
        raise AgentMailError("subject must be a non-empty string.")
    if not isinstance(text, str) or not text.strip():
        raise AgentMailError("text must be a non-empty string.")

    payload: Dict[str, Any] = {
        "to": to,
        "subject": subject.strip(),
        "text": text,
    }
    if args.get("html") is not None:
        if not isinstance(args["html"], str):
            raise AgentMailError("html must be a string.")
        payload["html"] = args["html"]
    cc = _validate_email_list(args.get("cc"), "cc", required=False)
    if cc:
        payload["cc"] = cc
    bcc = _validate_email_list(args.get("bcc"), "bcc", required=False)
    if bcc:
        payload["bcc"] = bcc
    if args.get("in_reply_to") is not None:
        if not isinstance(args["in_reply_to"], str):
            raise AgentMailError("in_reply_to must be a string.")
        if args["in_reply_to"].strip():
            payload["inReplyTo"] = args["in_reply_to"].strip()
    if args.get("references") is not None:
        if not isinstance(args["references"], str):
            raise AgentMailError("references must be a string.")
        if args["references"].strip():
            payload["references"] = args["references"].strip()

    return _ok(result=_request("POST", f"{_account_prefix(args)}/messages", payload))


def _get_attachment_url(args: Dict[str, Any]) -> str:
    message_id = _validate_id(args.get("message_id"), "message_id")
    attachment_id = _validate_id(args.get("attachment_id"), "attachment_id")
    path = f"{_account_prefix(args)}/messages/{message_id}/attachments/{attachment_id}"
    return _ok(attachment=_request("GET", path))


def _list_webhooks(args: Dict[str, Any]) -> str:
    return _ok(webhooks=_request("GET", f"{_account_prefix(args)}/webhooks"))


def _create_webhook(args: Dict[str, Any]) -> str:
    url = _validate_webhook_url(args.get("url"))
    return _ok(webhook=_request("POST", f"{_account_prefix(args)}/webhooks", {"url": url}))


def _delete_webhook(args: Dict[str, Any]) -> str:
    webhook_id = _validate_id(args.get("webhook_id"), "webhook_id")
    return _ok(deleted=_request("DELETE", f"{_account_prefix(args)}/webhooks/{webhook_id}"))


def get_mailbox(args: dict, **kwargs) -> str:
    return _run(_get_mailbox, args)


def list_messages(args: dict, **kwargs) -> str:
    return _run(_list_messages, args)


def get_message(args: dict, **kwargs) -> str:
    return _run(_get_message, args)


def send_email(args: dict, **kwargs) -> str:
    return _run(_send_email, args)


def get_attachment_url(args: dict, **kwargs) -> str:
    return _run(_get_attachment_url, args)


def list_webhooks(args: dict, **kwargs) -> str:
    return _run(_list_webhooks, args)


def create_webhook(args: dict, **kwargs) -> str:
    return _run(_create_webhook, args)


def delete_webhook(args: dict, **kwargs) -> str:
    return _run(_delete_webhook, args)
