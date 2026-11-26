"""Unit tests for the AgentMail Hermes plugin (stdlib only)."""

from __future__ import annotations

import importlib
import io
import json
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

_PLUGIN_DIR = Path(__file__).resolve().parent.parent / "integrations" / "hermes-plugin"
_PARENT_DIR = _PLUGIN_DIR.parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

# Stub agent.secret_scope when running outside a full Hermes install.
_SECRET_STORE: dict[str, str] = {}
if "agent.secret_scope" not in sys.modules:
    agent_mod = types.ModuleType("agent")
    secret_mod = types.ModuleType("agent.secret_scope")
    secret_mod.get_secret = lambda name, default="": _SECRET_STORE.get(name, default)
    agent_mod.secret_scope = secret_mod
    sys.modules["agent"] = agent_mod
    sys.modules["agent.secret_scope"] = secret_mod

# Load package from hyphenated directory name under a clean module alias.
import importlib.util

def _load_plugin():
    spec = importlib.util.spec_from_file_location(
        "theagentmail_plugin",
        _PLUGIN_DIR / "__init__.py",
        submodule_search_locations=[str(_PLUGIN_DIR)],
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["theagentmail_plugin"] = mod
    spec.loader.exec_module(mod)
    return mod

plugin = _load_plugin()
tools = sys.modules["theagentmail_plugin.tools"]
schemas = sys.modules["theagentmail_plugin.schemas"]


class _FakeResponse:
    def __init__(self, payload: dict):
        self._bytes = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._bytes

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class TestAgentMailHermesPlugin(unittest.TestCase):
    def setUp(self):
        _SECRET_STORE.clear()
        _SECRET_STORE["AGENTMAIL_API_KEY"] = "am_test_secret_key"

    def test_register_matches_plugin_yaml_provides_tools(self):
        registered = []

        class _Ctx:
            def register_tool(self, **kwargs):
                registered.append(kwargs)

        plugin.register(_Ctx())
        reg_names = [item["name"] for item in registered]
        yaml_text = (_PLUGIN_DIR / "plugin.yaml").read_text(encoding="utf-8")
        yaml_tools = []
        in_tools = False
        for line in yaml_text.splitlines():
            if line.startswith("provides_tools:"):
                in_tools = True
                continue
            if in_tools:
                if line.startswith("  - "):
                    yaml_tools.append(line.split("  - ", 1)[1].strip())
                else:
                    in_tools = False

        self.assertEqual(reg_names, yaml_tools)
        self.assertEqual(len(reg_names), 8)

    def test_is_configured(self):
        self.assertTrue(tools.is_configured())
        _SECRET_STORE.clear()
        self.assertFalse(tools.is_configured())

    def test_base_url_validation(self):
        self.assertEqual(tools._base_url(), "https://api.theagentmail.net")
        _SECRET_STORE["AGENTMAIL_API_URL"] = "https://mail.example.com/"
        self.assertEqual(tools._base_url(), "https://mail.example.com")
        _SECRET_STORE["AGENTMAIL_API_URL"] = "http://localhost:8787"
        self.assertEqual(tools._base_url(), "http://localhost:8787")

        for bad in (
            "http://api.example.com",
            "https://user:pass@api.example.com",
            "ftp://api.example.com",
            "https://api.example.com?foo=bar",
        ):
            _SECRET_STORE["AGENTMAIL_API_URL"] = bad
            with self.assertRaises(tools.AgentMailError):
                tools._base_url()

    def test_get_mailbox_account_and_org_routes(self):
        calls = []

        def fake_open(req, timeout=None):
            calls.append((req.get_method(), req.full_url, req.get_header("Authorization")))
            return _FakeResponse({"data": {"address": "bot@theagentmail.net"}})

        with mock.patch.object(tools._OPENER, "open", side_effect=fake_open):
            res1 = json.loads(tools.get_mailbox({}))
            res2 = json.loads(tools.get_mailbox({"account_id": "acc_123"}))

        self.assertTrue(res1["ok"])
        self.assertEqual(calls[0], ("GET", "https://api.theagentmail.net/v1/account", "Bearer am_test_secret_key"))
        self.assertTrue(res2["ok"])
        self.assertEqual(calls[1], ("GET", "https://api.theagentmail.net/v1/accounts/acc_123", "Bearer am_test_secret_key"))

    def test_list_messages_slices_limit(self):
        msgs = [{"id": f"m{i}"} for i in range(5)]
        with mock.patch.object(tools._OPENER, "open", return_value=_FakeResponse({"data": msgs})):
            res = json.loads(tools.list_messages({"limit": 2}))
        self.assertTrue(res["ok"])
        self.assertEqual(len(res["messages"]), 2)
        self.assertEqual(res["total"], 5)

    def test_send_email_payload_and_validation(self):
        captured = {}

        def fake_open(req, timeout=None):
            captured["method"] = req.get_method()
            captured["url"] = req.full_url
            captured["body"] = json.loads(req.data.decode("utf-8"))
            return _FakeResponse({"data": {"id": "msg_1"}})

        with mock.patch.object(tools._OPENER, "open", side_effect=fake_open):
            res = json.loads(
                tools.send_email(
                    {
                        "to": ["alice@example.com"],
                        "subject": "Hello",
                        "text": "Body text",
                        "in_reply_to": "<abc@example.com>",
                    }
                )
            )
        self.assertTrue(res["ok"])
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["url"], "https://api.theagentmail.net/v1/messages")
        self.assertEqual(captured["body"]["inReplyTo"], "<abc@example.com>")

        bad = json.loads(tools.send_email({"to": [], "subject": "Hi", "text": "x"}))
        self.assertFalse(bad["ok"])

    def test_path_traversal_rejected(self):
        bad = json.loads(tools.get_message({"message_id": "../secret"}))
        self.assertFalse(bad["ok"])

    def test_create_webhook_requires_https(self):
        bad = json.loads(tools.create_webhook({"url": "http://example.com/hook"}))
        self.assertFalse(bad["ok"])


if __name__ == "__main__":
    unittest.main()
