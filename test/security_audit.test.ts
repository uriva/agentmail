import { assert, assertEquals, assertThrows } from "@std/assert";
import { encodeBase64 } from "@std/encoding/base64";
import rules from "../instant.perms.ts";
import { db, id } from "../src/db.ts";
import { createAccount } from "../src/handlers/accounts.ts";
import { handleInbound } from "../src/handlers/inbound.ts";
import {
  handleLookupMailbox,
  handleLookupUser,
  handleSupportPrompt,
} from "../src/handlers/supportBot.ts";
import { handleRequest } from "../src/main.ts";
import {
  hmacSha256Hex,
  normalizeE164Phone,
  sanitizeAttachmentFilename,
  validateWebhookTargetUrl,
} from "../src/security.ts";
import { combineScanBody } from "../src/services/jev.ts";
import { resolveAllowedCheckoutReturnUrl } from "../src/services/stripe.ts";
import { checkTwilioVerification } from "../src/services/twilio.ts";
import { buildEmailIframeSrcDoc } from "../web/src/sanitizeHtml.ts";

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

Deno.test("instant.perms.ts enforces default deny, blocks all client writes, and hides sensitive fields", () => {
  const perms: Record<string, unknown> = rules;
  assertEquals(perms.$default, { allow: { $default: "false" } });
  assertEquals(perms.attrs, {
    allow: { $default: "false", create: "false" },
  });

  const appEntities = [
    "organizations",
    "accounts",
    "apiKeys",
    "karmaEvents",
    "messages",
    "attachments",
    "webhookSubscriptions",
  ] as const;

  for (const name of appEntities) {
    const entry = perms[name] as { allow: Record<string, string> };
    assertEquals(entry.allow.create, "false", `${name}.create must be false`);
    assertEquals(entry.allow.update, "false", `${name}.update must be false`);
    assertEquals(entry.allow.delete, "false", `${name}.delete must be false`);
    assert(
      entry.allow.view.startsWith("auth.id != null &&"),
      `${name}.view must require authenticated user`,
    );
  }

  assertEquals(
    (perms.apiKeys as { fields: Record<string, string> }).fields.keyHash,
    "false",
  );
  assertEquals(
    (perms.webhookSubscriptions as { fields: Record<string, string> }).fields
      .secret,
    "false",
  );
  assertEquals(
    (perms.organizations as { fields: Record<string, string> }).fields
      .processedCheckoutSessions,
    "false",
  );
  assertEquals(
    (perms.attachments as { fields: Record<string, string> }).fields.storageKey,
    "false",
  );
});

Deno.test("inbound webhook: rejects unsigned, unconfigured, stale, and replayed requests, and enforces envelope routing", async () => {
  const orgId = id();
  const boxAId = id();
  const boxBId = id();
  const addrA = `boxa-${boxAId}@theagentmail.net`;
  const addrB = `boxb-${boxBId}@theagentmail.net`;

  await db.transact([
    db.tx.organizations[orgId]!.update({
      name: "Inbound Security Org",
      createdAt: Date.now(),
      balance: 5,
      trialUsed: true,
    }),
    db.tx.accounts[boxAId]!.update({
      address: addrA,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      isFrozen: false,
    }),
    db.tx.accounts[boxAId]!.link({ organization: orgId }),
    db.tx.accounts[boxBId]!.update({
      address: addrB,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
      isFrozen: false,
    }),
    db.tx.accounts[boxBId]!.link({ organization: orgId }),
  ]);

  const body = JSON.stringify({
    from: "attacker@example.com",
    to: [addrA],
    cc: [addrB],
    received_for: addrA,
    subject: "Envelope test",
    text: "Hello",
  });

  // 1. Missing INBOUND_WEBHOOK_SECRET -> 401
  Deno.env.delete("INBOUND_WEBHOOK_SECRET");
  const unconfiguredRes = await handleInbound(
    new Request("http://localhost/inbound", { method: "POST", body }),
    {},
    "",
  );
  assertEquals(unconfiguredRes.status, 401);

  // 2. Configured secret, missing signature headers -> 401
  const secret = "whsec_" +
    encodeBase64(new TextEncoder().encode("supersecretkey1234567890"));
  Deno.env.set("INBOUND_WEBHOOK_SECRET", secret);
  const unsignedRes = await handleInbound(
    new Request("http://localhost/inbound", { method: "POST", body }),
    {},
    "",
  );
  assertEquals(unsignedRes.status, 401);

  // 3. Stale Svix timestamp -> 401
  const rawKeyBytes = new TextEncoder().encode("supersecretkey1234567890");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const oldTs = String(Math.floor(Date.now() / 1000) - 3600);
  const oldSigned = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`msg_old.${oldTs}.${body}`),
  );
  const staleRes = await handleInbound(
    new Request("http://localhost/inbound", {
      method: "POST",
      headers: {
        "svix-id": "msg_old",
        "svix-timestamp": oldTs,
        "svix-signature": `v1,${encodeBase64(oldSigned)}`,
      },
      body,
    }),
    {},
    "",
  );
  assertEquals(staleRes.status, 401);

  // 4. Valid fresh Svix signature succeeds once, replay fails with 401, and CC victim boxB is NOT polluted
  const freshTs = String(Math.floor(Date.now() / 1000));
  const freshId = `msg_${crypto.randomUUID()}`;
  const freshSigned = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${freshId}.${freshTs}.${body}`),
  );
  const makeSvixReq = () =>
    new Request("http://localhost/inbound", {
      method: "POST",
      headers: {
        "svix-id": freshId,
        "svix-timestamp": freshTs,
        "svix-signature": `v1,${encodeBase64(freshSigned)}`,
      },
      body,
    });

  const okRes = await handleInbound(makeSvixReq(), {}, "");
  assertEquals(okRes.status, 200);
  assertEquals((await okRes.json()).matched, 1);

  const replayRes = await handleInbound(makeSvixReq(), {}, "");
  assertEquals(replayRes.status, 401);

  const { messages: boxBMessages } = await db.query({
    messages: { $: { where: { "account.id": boxBId } } },
  });
  assertEquals(
    boxBMessages.length,
    0,
    "Unverified MIME Cc must not deliver into victim mailbox when received_for is present",
  );
});

Deno.test("support bot endpoints: fail closed when secret unset or unsigned and redact webhook URLs", async () => {
  Deno.env.delete("SUPPORT_BOT_SECRET");

  assertEquals(
    (await handleSupportPrompt(
      new Request("http://localhost/v1/support/prompt", { method: "POST" }),
    )).status,
    401,
  );
  assertEquals(
    (await handleLookupUser(
      new Request("http://localhost/v1/support/tools/lookup-user", {
        method: "POST",
        body: JSON.stringify({
          payload: { params: { email: "a@example.com" } },
        }),
      }),
    )).status,
    401,
  );

  Deno.env.set("SUPPORT_BOT_SECRET", "support-secret-abc");
  const orgId = id();
  const accId = id();
  const whId = id();
  await db.transact([
    db.tx.organizations[orgId]!.update({
      name: "Support Redact Org",
      createdAt: Date.now(),
    }),
    db.tx.accounts[accId]!.update({
      address: `redact-${accId}@theagentmail.net`,
      createdAt: Date.now(),
    }),
    db.tx.accounts[accId]!.link({ organization: orgId }),
    db.tx.webhookSubscriptions[whId]!.update({
      url: "https://hooks.example.com/secret-path?token=supersecret",
      secret: "whsec",
      active: true,
      createdAt: Date.now(),
    }),
    db.tx.webhookSubscriptions[whId]!.link({ account: accId }),
  ]);

  const payload = {
    meta: { timestamp: String(Date.now()), nonce: crypto.randomUUID() },
    params: { address: `redact-${accId}@theagentmail.net` },
  };
  const signature = await hmacSha256Hex(
    "support-secret-abc",
    JSON.stringify(payload),
  );
  const res = await handleLookupMailbox(
    new Request("http://localhost/v1/support/tools/lookup-mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, signature }),
    }),
  );
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.webhooks[0].host, "hooks.example.com");
  assertEquals("url" in data.webhooks[0], false);
});

Deno.test("API key scoping: account-scoped keys blocked from org routes and org-scoped keys blocked from shortcut routes", async () => {
  const orgId = id();
  const acc1Id = id();
  const acc2Id = id();
  const orgKeyPlain = "am_org_key_111111111111111111111111111111";
  const accKeyPlain = "am_acc_key_222222222222222222222222222222";
  const orgKeyId = id();
  const accKeyId = id();

  await db.transact([
    db.tx.organizations[orgId]!.update({
      name: "Key Scope Org",
      createdAt: Date.now(),
      balance: 10,
      trialUsed: true,
    }),
    db.tx.accounts[acc1Id]!.update({
      address: `scope1-${acc1Id}@theagentmail.net`,
      createdAt: Date.now(),
    }),
    db.tx.accounts[acc1Id]!.link({ organization: orgId }),
    db.tx.accounts[acc2Id]!.update({
      address: `scope2-${acc2Id}@theagentmail.net`,
      createdAt: Date.now(),
    }),
    db.tx.accounts[acc2Id]!.link({ organization: orgId }),
    db.tx.apiKeys[orgKeyId]!.update({
      keyHash: await sha256Hex(orgKeyPlain),
      prefix: "am_org_key",
      name: "Org Key",
      createdAt: Date.now(),
    }),
    db.tx.apiKeys[orgKeyId]!.link({ organization: orgId }),
    db.tx.apiKeys[accKeyId]!.update({
      keyHash: await sha256Hex(accKeyPlain),
      prefix: "am_acc_key",
      name: "Acc1 Key",
      createdAt: Date.now(),
    }),
    db.tx.apiKeys[accKeyId]!.link({ organization: orgId, account: acc1Id }),
  ]);

  // Account-scoped key cannot list all org mailboxes, create paid mailboxes, mint new keys, or view billing
  for (
    const [method, path] of [
      ["GET", "/v1/accounts"],
      ["POST", "/v1/accounts"],
      ["DELETE", `/v1/accounts/${acc1Id}`],
      ["POST", `/v1/accounts/${acc1Id}/api-keys`],
      ["GET", "/v1/billing/balance"],
    ] as const
  ) {
    const res = await handleRequest(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accKeyPlain}`,
          "Content-Type": "application/json",
        },
        ...(method === "POST"
          ? { body: JSON.stringify({ address: "newbox" }) }
          : {}),
      }),
    );
    assertEquals(
      res.status,
      403,
      `Expected 403 for account key on ${method} ${path}`,
    );
  }

  // Org-scoped key cannot call shortcut routes (/v1/account, DELETE /v1/account, /v1/messages)
  for (
    const [method, path] of [
      ["GET", "/v1/account"],
      ["DELETE", "/v1/account"],
      ["GET", "/v1/messages"],
      ["GET", "/v1/webhooks"],
    ] as const
  ) {
    const res = await handleRequest(
      new Request(`http://localhost${path}`, {
        method,
        headers: { Authorization: `Bearer ${orgKeyPlain}` },
      }),
    );
    assertEquals(
      res.status,
      403,
      `Expected 403 for org key on shortcut ${method} ${path}`,
    );
  }

  // Account-scoped key CAN read its own /v1/account
  const ownRes = await handleRequest(
    new Request("http://localhost/v1/account", {
      method: "GET",
      headers: { Authorization: `Bearer ${accKeyPlain}` },
    }),
  );
  assertEquals(ownRes.status, 200);
});

Deno.test("reserved CA DCV addresses, local-part validation, and concurrent trial creation lock", async () => {
  const userId = id();
  const orgId = id();
  await db.transact([
    db.tx.$users[userId]!.update({
      email: `race-${userId}@example.com`,
      phoneVerified: true,
    }),
    db.tx.organizations[orgId]!.update({
      name: "Race Org",
      createdAt: Date.now(),
      balance: 0,
      trialUsed: false,
      admin: false,
    }),
    db.tx.organizations[orgId]!.link({ billingUser: userId, members: userId }),
  ]);

  for (
    const reserved of [
      "postmaster",
      "hostmaster",
      "webmaster",
      "abuse",
      "dmarc",
      "noreply",
      "mailer-daemon",
      "root",
    ]
  ) {
    const res = await createAccount(
      new Request("http://localhost/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: reserved }),
      }),
      {},
      orgId,
    );
    assertEquals(res.status, 400, `Expected ${reserved} to be blocked`);
  }

  for (const invalid of ["bot+alias", "two..dots", "-leading", "bad space"]) {
    const res = await createAccount(
      new Request("http://localhost/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: invalid }),
      }),
      {},
      orgId,
    );
    assertEquals(res.status, 400, `Expected ${invalid} to fail format check`);
  }

  // Fire 5 concurrent trial mailbox creations -> exactly 1 must succeed (201) and 4 must fail (402)
  const concurrent = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      createAccount(
        new Request("http://localhost/v1/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: `concurrent-${n}-${orgId.slice(0, 8)}`,
          }),
        }),
        {},
        orgId,
      )
    ),
  );
  const statuses = concurrent.map((r) => r.status).toSorted();
  assertEquals(statuses, [201, 402, 402, 402, 402]);
});

Deno.test("webhook SSRF guard, phone canonicalization, JEV dual body scan, Stripe redirect guard, and email HTML sandbox", async () => {
  // Webhook SSRF
  const prevEnv = Deno.env.get("DENO_ENV");
  Deno.env.set("DENO_ENV", "production");
  try {
    assertEquals(validateWebhookTargetUrl("http://hooks.example.com/wh"), null);
    assertEquals(validateWebhookTargetUrl("https://127.0.0.1/wh"), null);
    assertEquals(
      validateWebhookTargetUrl("https://169.254.169.254/latest"),
      null,
    );
    assertEquals(validateWebhookTargetUrl("https://10.0.0.5/wh"), null);
    assertEquals(validateWebhookTargetUrl("https://[::1]/wh"), null);
    assertEquals(
      validateWebhookTargetUrl("https://api.theagentmail.net/inbound"),
      null,
    );
    assertEquals(
      validateWebhookTargetUrl("https://hooks.example.com/wh"),
      "https://hooks.example.com/wh",
    );
    // Twilio fail-closed in production when unconfigured
    assertEquals(
      await checkTwilioVerification("+14155552671", "123456"),
      false,
    );
  } finally {
    if (prevEnv !== undefined) Deno.env.set("DENO_ENV", prevEnv);
  }

  // Phone canonicalization
  assertEquals(normalizeE164Phone("+1 (415) 555-2671"), "+14155552671");
  assertEquals(normalizeE164Phone("1-415-555-2671"), "+14155552671");
  assertEquals(normalizeE164Phone("14155552671"), "+14155552671");
  assertEquals(normalizeE164Phone("123"), null);

  // Attachment filename sanitization
  assertEquals(sanitizeAttachmentFilename("../../etc/passwd"), "passwd");
  assertEquals(sanitizeAttachmentFilename('evil".html'), "evil_.html");

  // JEV combines both text and html so benign text cannot shadow malicious html
  const combined = combineScanBody({
    subject: "Hello",
    text: "Innocent text body",
    html: '<a href="https://phish.example">Verify bank</a>',
  });
  assert(combined.includes("Innocent text body"));
  assert(combined.includes("https://phish.example"));

  // Stripe return URL allowlist
  assertThrows(() =>
    resolveAllowedCheckoutReturnUrl(
      "https://evil.example/steal",
      "https://theagentmail.net/app",
    )
  );
  assertEquals(
    resolveAllowedCheckoutReturnUrl(
      "https://theagentmail.net/app?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      "https://theagentmail.net/app",
    ),
    "https://theagentmail.net/app?checkout=success&session_id={CHECKOUT_SESSION_ID}",
  );

  // Email HTML iframe srcDoc contains strict CSP
  const srcDoc = buildEmailIframeSrcDoc(
    '<img src=x onerror="alert(1)"><script>evil()</script>',
  );
  assert(srcDoc.includes("default-src 'none'"));
});
