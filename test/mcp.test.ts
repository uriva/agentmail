import { assert, assertEquals } from "@std/assert";
import { db, id } from "../src/db.ts";
import { handleRequest } from "../src/main.ts";

Deno.env.set("DENO_ENV", "test");

const sha256Hex = async (raw: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const mcpPost = (token: string, body: unknown) =>
  handleRequest(
    new Request("https://api.theagentmail.net/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );

Deno.test("POST /mcp supports Streamable HTTP MCP initialize, tools/list, tools/call, and enforces account key scoping", async () => {
  const orgId = id();
  const acc1Id = id();
  const acc2Id = id();
  const msgId = id();
  const orgKey = `am_org_${id()}`;
  const acc1Key = `am_acc_${id()}`;
  const now = Date.now();

  await db.transact([
    db.tx.organizations[orgId]!.update({
      name: "MCP Test Org",
      createdAt: now,
      balance: 5,
      trialUsed: true,
    }),
    db.tx.apiKeys[id()]!
      .update({
        keyHash: await sha256Hex(orgKey),
        prefix: "am_org_",
        name: "Org",
        createdAt: now,
      })
      .link({ organization: orgId }),
    db.tx.accounts[acc1Id]!
      .update({
        address: `mcp1-${acc1Id}@theagentmail.net`,
        createdAt: now,
        expiresAt: now + 30 * 86_400_000,
      })
      .link({ organization: orgId }),
    db.tx.accounts[acc2Id]!
      .update({
        address: `mcp2-${acc2Id}@theagentmail.net`,
        createdAt: now,
        expiresAt: now + 30 * 86_400_000,
      })
      .link({ organization: orgId }),
    db.tx.apiKeys[id()]!
      .update({
        keyHash: await sha256Hex(acc1Key),
        prefix: "am_acc_",
        name: "Acc1",
        createdAt: now,
      })
      .link({ organization: orgId, account: acc1Id }),
    db.tx.messages[msgId]!
      .update({
        from: "github@github.com",
        to: [`mcp1-${acc1Id}@theagentmail.net`],
        subject: "OTP 123456",
        bodyText: "Code: 123456",
        direction: "inbound",
        status: "received",
        timestamp: now,
      })
      .link({ account: acc1Id }),
  ]);

  const unauthRes = await handleRequest(
    new Request("https://api.theagentmail.net/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    }),
  );
  assertEquals(unauthRes.status, 401);

  const initRes = await mcpPost(acc1Key, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
  });
  assertEquals(initRes.status, 200);
  const initJson = await initRes.json();
  assertEquals(initJson.result.serverInfo.name, "agentmail");

  const scopedToolsRes = await mcpPost(acc1Key, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const scopedTools = (await scopedToolsRes.json()).result.tools.map(
    (t: { name: string }) => t.name,
  );
  assert(scopedTools.includes("send_email"));
  assert(scopedTools.includes("list_messages"));
  assert(!scopedTools.includes("list_mailboxes"));

  const orgToolsRes = await mcpPost(orgKey, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/list",
  });
  const orgTools = (await orgToolsRes.json()).result.tools.map(
    (t: { name: string }) => t.name,
  );
  assert(orgTools.includes("list_mailboxes"));
  assert(orgTools.includes("create_mailbox"));
  assert(orgTools.includes("get_balance"));

  const listMsgRes = await mcpPost(acc1Key, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "list_messages", arguments: {} },
  });
  const listMsgJson = await listMsgRes.json();
  assertEquals(listMsgJson.result.isError, false);
  assert(listMsgJson.result.content[0].text.includes("OTP 123456"));

  const crossAccRes = await mcpPost(acc1Key, {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "list_messages", arguments: { accountId: acc2Id } },
  });
  const crossAccJson = await crossAccRes.json();
  assertEquals(crossAccJson.result.isError, true);

  const forbiddenOrgRes = await mcpPost(acc1Key, {
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "list_mailboxes", arguments: {} },
  });
  const forbiddenOrgJson = await forbiddenOrgRes.json();
  assertEquals(forbiddenOrgJson.result.isError, true);

  const orgListRes = await mcpPost(orgKey, {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "list_mailboxes", arguments: {} },
  });
  const orgListJson = await orgListRes.json();
  assertEquals(orgListJson.result.isError, false);
  assert(orgListJson.result.content[0].text.includes(`mcp2-${acc2Id}@theagentmail.net`));
});
