import { useState } from "preact/hooks";
import { useQuery, useAuth } from "./db.ts";

// @ts-ignore: Vite injects import.meta.env at build time
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";

const apiHeaders = (userToken: string, orgId: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${userToken}`,
  "X-Org-Id": orgId,
});

const Card = ({
  title,
  children,
}: {
  title: string;
  children: preact.ComponentChildren;
}) => (
  <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
    <h2 class="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
      {title}
    </h2>
    {children}
  </div>
);

const StatNumber = ({
  value,
  label,
  color = "text-white",
}: {
  value: string | number;
  label: string;
  color?: string;
}) => (
  <div>
    <div class={`text-3xl font-bold ${color}`}>{value}</div>
    <div class="text-sm text-slate-400 mt-1">{label}</div>
  </div>
);

const KarmaSection = ({ orgId }: { orgId: string }) => {
  const { isLoading, error, data } = useQuery({
    karmaEvents: { $: { where: { "organization.id": orgId } } },
  });

  if (isLoading) return <div class="text-slate-400">Loading karma...</div>;
  if (error)
    return <div class="text-red-400">Error loading karma: {error.message}</div>;

  const events = data?.karmaEvents ?? [];
  const balance = events.reduce(
    (sum: number, e: { amount: number }) => sum + e.amount,
    0,
  );
  const sent = events.filter(
    (e: { type: string }) => e.type === "email_sent",
  ).length;
  const received = events.filter(
    (e: { type: string }) => e.type === "email_received",
  ).length;
  const accountsCreated = events.filter(
    (e: { type: string }) => e.type === "account_created",
  ).length;

  const balanceColor =
    balance > 50 ? "text-green-400" : balance > 10 ? "text-yellow-400" : "text-red-400";

  return (
    <Card title="Karma">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <StatNumber value={balance.toFixed(1)} label="Balance" color={balanceColor} />
        <StatNumber value={sent} label="Emails Sent" />
        <StatNumber value={received} label="Emails Received" />
        <StatNumber value={accountsCreated} label="Accounts Created" />
      </div>
      {balance <= 0 && (
        <div class="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          Your karma balance is depleted. Sends and account creation are blocked.
        </div>
      )}
    </Card>
  );
};

const AccountsList = ({
  orgId,
  userToken,
}: {
  orgId: string;
  userToken: string;
}) => {
  const { isLoading, error, data } = useQuery({
    accounts: {
      $: { where: { "organization.id": orgId } },
      messages: {},
      webhooks: {},
    },
  });

  const [newAddress, setNewAddress] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [webhookFor, setWebhookFor] = useState<string | null>(null);
  const [apiKeyFor, setApiKeyFor] = useState<string | null>(null);

  const handleCreateAccount = async () => {
    const address = newAddress.trim();
    if (!address) return;
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, string> = { address };
      if (newDisplayName.trim()) body.displayName = newDisplayName.trim();
      const res = await fetch(`${API_BASE}/v1/accounts`, {
        method: "POST",
        headers: apiHeaders(userToken, orgId),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create account");
      }
      setNewAddress("");
      setNewDisplayName("");
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return <div class="text-slate-400">Loading accounts...</div>;
  if (error)
    return (
      <div class="text-red-400">Error loading accounts: {error.message}</div>
    );

  const accounts = data?.accounts ?? [];

  return (
    <Card title={`Email Accounts (${accounts.length})`}>
      <div class="flex gap-2 mb-4">
        <input
          type="text"
          value={newAddress}
          onInput={(e: Event) =>
            setNewAddress((e.target as HTMLInputElement).value)
          }
          placeholder="address (e.g. my-agent)"
          class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <input
          type="text"
          value={newDisplayName}
          onInput={(e: Event) =>
            setNewDisplayName((e.target as HTMLInputElement).value)
          }
          placeholder="Display name (optional)"
          class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleCreateAccount}
          disabled={creating || !newAddress.trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          {creating ? "Creating..." : "Create Account"}
        </button>
      </div>
      {createError && (
        <div class="mb-4 text-red-400 text-sm">{createError}</div>
      )}

      {accounts.length === 0 ? (
        <div class="text-slate-500 text-center py-4">
          No email accounts yet. Create one above.
        </div>
      ) : (
        <div class="space-y-3">
          {accounts.map(
            (account: {
              id: string;
              address: string;
              displayName?: string;
              messages: { id: string; direction: string; timestamp: number }[];
              webhooks: { id: string; url: string; active: boolean; createdAt: number }[];
              createdAt: number;
            }) => {
              const inbound = account.messages.filter(
                (m) => m.direction === "inbound",
              ).length;
              const outbound = account.messages.filter(
                (m) => m.direction === "outbound",
              ).length;
              return (
                <div key={account.id}>
                  <div class="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                    <div class="flex items-center justify-between mb-2">
                      <div>
                        <span class="text-white font-mono text-sm">
                          {account.address}
                        </span>
                        {account.displayName && (
                          <span class="text-slate-400 text-sm ml-2">
                            ({account.displayName})
                          </span>
                        )}
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-500">
                          {new Date(account.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() =>
                            setSendingFor(
                              sendingFor === account.id ? null : account.id,
                            )
                          }
                          class="text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors"
                        >
                          {sendingFor === account.id ? "Cancel" : "Send"}
                        </button>
                        <button
                          onClick={() =>
                            setWebhookFor(
                              webhookFor === account.id ? null : account.id,
                            )
                          }
                          class="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors"
                        >
                          {webhookFor === account.id ? "Cancel" : "Webhooks"}
                        </button>
                        <button
                          onClick={() =>
                            setApiKeyFor(
                              apiKeyFor === account.id ? null : account.id,
                            )
                          }
                          class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                        >
                          {apiKeyFor === account.id ? "Cancel" : "API Key"}
                        </button>
                      </div>
                    </div>
                    <div class="flex gap-4 text-sm">
                      <span class="text-slate-400">
                        <span class="text-blue-400 font-medium">{inbound}</span>{" "}
                        received
                      </span>
                      <span class="text-slate-400">
                        <span class="text-emerald-400 font-medium">
                          {outbound}
                        </span>{" "}
                        sent
                      </span>
                      <span class="text-slate-400">
                        <span class="text-purple-400 font-medium">
                          {account.webhooks.length}
                        </span>{" "}
                        webhooks
                      </span>
                    </div>
                  </div>
                  {sendingFor === account.id && (
                    <SendMessageForm
                      accountId={account.id}
                      fromAddress={account.address}
                      userToken={userToken}
                      orgId={orgId}
                      onDone={() => setSendingFor(null)}
                    />
                  )}
                  {webhookFor === account.id && (
                    <WebhookManager
                      accountId={account.id}
                      webhooks={account.webhooks}
                      userToken={userToken}
                      orgId={orgId}
                    />
                  )}
                  {apiKeyFor === account.id && (
                    <AccountApiKey
                      accountId={account.id}
                      userToken={userToken}
                      orgId={orgId}
                    />
                  )}
                </div>
              );
            },
          )}
        </div>
      )}
    </Card>
  );
};

const WebhookManager = ({
  accountId,
  webhooks,
  userToken,
  orgId,
}: {
  accountId: string;
  webhooks: { id: string; url: string; active: boolean; createdAt: number }[];
  userToken: string;
  orgId: string;
}) => {
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addedSecret, setAddedSecret] = useState<string | null>(null);

  const handleAdd = async () => {
    const url = newUrl.trim();
    if (!url) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/accounts/${accountId}/webhooks`,
        {
          method: "POST",
          headers: apiHeaders(userToken, orgId),
          body: JSON.stringify({ url }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add webhook");
      }
      const { data } = await res.json();
      setAddedSecret(data.secret);
      setNewUrl("");
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    setDeletingId(webhookId);
    try {
      await fetch(
        `${API_BASE}/v1/accounts/${accountId}/webhooks/${webhookId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${userToken}`, "X-Org-Id": orgId },
        },
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div class="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-3">
      <div class="text-xs text-slate-400 font-medium uppercase tracking-wider">
        Webhooks
      </div>

      {addedSecret && (
        <div class="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg">
          <div class="text-emerald-300 text-sm mb-1">
            Webhook created. Save the signing secret:
          </div>
          <code class="text-emerald-200 text-xs font-mono break-all select-all">
            {addedSecret}
          </code>
          <button
            onClick={() => setAddedSecret(null)}
            class="block mt-2 text-xs text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {webhooks.length > 0 && (
        <div class="space-y-2">
          {webhooks.map((w) => (
            <div
              key={w.id}
              class="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class={`w-2 h-2 rounded-full flex-shrink-0 ${w.active ? "bg-green-400" : "bg-slate-500"}`}
                />
                <span class="text-sm text-white font-mono truncate">
                  {w.url}
                </span>
              </div>
              <button
                onClick={() => handleDelete(w.id)}
                disabled={deletingId === w.id}
                class="text-xs text-red-400 hover:text-red-300 disabled:text-slate-600 transition-colors flex-shrink-0 ml-2"
              >
                {deletingId === w.id ? "..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div class="flex gap-2">
        <input
          type="text"
          value={newUrl}
          onInput={(e: Event) =>
            setNewUrl((e.target as HTMLInputElement).value)
          }
          placeholder="https://my-agent.example.com/inbox"
          class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newUrl.trim()}
          class="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>
      {addError && <div class="text-red-400 text-sm">{addError}</div>}
    </div>
  );
};

const AccountApiKey = ({
  accountId,
  userToken,
  orgId,
}: {
  accountId: string;
  userToken: string;
  orgId: string;
}) => {
  const { isLoading, data } = useQuery({
    apiKeys: {
      $: { where: { "account.id": accountId } },
    },
  });

  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/accounts/${accountId}/api-keys`,
        {
          method: "POST",
          headers: apiHeaders(userToken, orgId),
          body: JSON.stringify({ name: "Account key" }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create API key");
      }
      const { data: keyData } = await res.json();
      setCreatedKey(keyData.key);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (apiKeyId: string) => {
    setDeletingId(apiKeyId);
    try {
      await fetch(`${API_BASE}/v1/api-keys/${apiKeyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}`, "X-Org-Id": orgId },
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const keys = data?.apiKeys ?? [];

  return (
    <div class="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-3">
      <div class="text-xs text-slate-400 font-medium uppercase tracking-wider">
        API Key
      </div>

      {createdKey && (
        <div class="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg">
          <div class="text-emerald-300 text-sm mb-1">
            Key created. Copy it now -- it won't be shown again.
          </div>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-slate-900 text-emerald-200 px-3 py-2 rounded font-mono text-xs break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={() => handleCopy(createdKey)}
              class="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded transition-colors flex-shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            class="block mt-2 text-xs text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isLoading && keys.length > 0 && (
        <div class="space-y-2">
          {keys.map(
            (k: { id: string; prefix: string; name: string; createdAt: number }) => (
              <div
                key={k.id}
                class="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700"
              >
                <span class="text-sm text-white font-mono">
                  {k.prefix}...
                </span>
                <button
                  onClick={() => handleDelete(k.id)}
                  disabled={deletingId === k.id}
                  class="text-xs text-red-400 hover:text-red-300 disabled:text-slate-600 transition-colors"
                >
                  {deletingId === k.id ? "..." : "Delete"}
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {!isLoading && keys.length === 0 && !createdKey && (
        <button
          onClick={handleCreate}
          disabled={creating}
          class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {creating ? "Creating..." : "Generate API Key"}
        </button>
      )}

      {createError && <div class="text-red-400 text-sm">{createError}</div>}
    </div>
  );
};

const SendMessageForm = ({
  accountId,
  fromAddress,
  userToken,
  orgId,
  onDone,
}: {
  accountId: string;
  fromAddress: string;
  userToken: string;
  orgId: string;
  onDone: () => void;
}) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/accounts/${accountId}/messages`,
        {
          method: "POST",
          headers: apiHeaders(userToken, orgId),
          body: JSON.stringify({
            to: to
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean),
            subject: subject.trim(),
            text: body,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }
      setSent(true);
      setTimeout(() => {
        setSent(false);
        onDone();
      }, 2000);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div class="mt-2 p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg text-emerald-300 text-sm">
        Message sent!
      </div>
    );
  }

  return (
    <div class="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-3">
      <div class="text-xs text-slate-400">
        From: <span class="text-white font-mono">{fromAddress}</span>
      </div>
      <input
        type="text"
        value={to}
        onInput={(e: Event) => setTo((e.target as HTMLInputElement).value)}
        placeholder="To (comma-separated emails)"
        class="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
      />
      <input
        type="text"
        value={subject}
        onInput={(e: Event) =>
          setSubject((e.target as HTMLInputElement).value)
        }
        placeholder="Subject"
        class="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
      />
      <textarea
        value={body}
        onInput={(e: Event) => setBody((e.target as HTMLTextAreaElement).value)}
        placeholder="Message body"
        rows={4}
        class="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-y"
      />
      {sendError && <div class="text-red-400 text-sm">{sendError}</div>}
      <div class="flex justify-end">
        <button
          onClick={handleSend}
          disabled={sending || !to.trim() || !subject.trim()}
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
      </div>
    </div>
  );
};

const RecentMessages = ({ orgId }: { orgId: string }) => {
  const { isLoading, error, data } = useQuery({
    accounts: {
      $: { where: { "organization.id": orgId } },
      messages: {},
    },
  });

  if (isLoading) return <div class="text-slate-400">Loading messages...</div>;
  if (error)
    return (
      <div class="text-red-400">Error loading messages: {error.message}</div>
    );

  const allMessages = (data?.accounts ?? [])
    .flatMap(
      (a: {
        address: string;
        messages: {
          id: string;
          from: string;
          to: unknown;
          subject: string;
          direction: string;
          status: string;
          timestamp: number;
        }[];
      }) => a.messages.map((m) => ({ ...m, accountAddress: a.address })),
    )
    .sort(
      (a: { timestamp: number }, b: { timestamp: number }) =>
        b.timestamp - a.timestamp,
    )
    .slice(0, 20);

  if (allMessages.length === 0) {
    return (
      <Card title="Recent Messages">
        <div class="text-slate-500 text-center py-8">No messages yet.</div>
      </Card>
    );
  }

  return (
    <Card title="Recent Messages">
      <div class="space-y-2">
        {allMessages.map(
          (msg: {
            id: string;
            from: string;
            subject: string;
            direction: string;
            status: string;
            timestamp: number;
            accountAddress: string;
          }) => (
            <div
              key={msg.id}
              class="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700"
            >
              <span
                class={`text-xs px-2 py-0.5 rounded font-medium ${
                  msg.direction === "inbound"
                    ? "bg-blue-900/50 text-blue-300"
                    : "bg-emerald-900/50 text-emerald-300"
                }`}
              >
                {msg.direction === "inbound" ? "IN" : "OUT"}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-white truncate">
                  {msg.subject || "(no subject)"}
                </div>
                <div class="text-xs text-slate-400 truncate">
                  {msg.direction === "inbound"
                    ? `From: ${msg.from}`
                    : `To: ${msg.accountAddress}`}
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <span
                  class={`text-xs ${
                    msg.status === "sent" || msg.status === "delivered"
                      ? "text-green-400"
                      : msg.status === "failed"
                        ? "text-red-400"
                        : "text-slate-400"
                  }`}
                >
                  {msg.status}
                </span>
                <div class="text-xs text-slate-500 mt-0.5">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </Card>
  );
};

const ApiKeySection = ({
  orgId,
  userToken,
}: {
  orgId: string;
  userToken: string;
}) => {
  const { isLoading, error, data } = useQuery({
    apiKeys: {
      $: { where: { "organization.id": orgId } },
      account: {},
    },
  });

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const name = newKeyName.trim() || "Default";
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys`, {
        method: "POST",
        headers: apiHeaders(userToken, orgId),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create API key");
      }
      const { data: keyData } = await res.json();
      setCreatedKey(keyData.key);
      setNewKeyName("");
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (apiKeyId: string) => {
    setDeletingId(apiKeyId);
    try {
      await fetch(`${API_BASE}/v1/api-keys/${apiKeyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}`, "X-Org-Id": orgId },
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (isLoading) return <div class="text-slate-400">Loading API keys...</div>;
  if (error) return <div class="text-red-400">Error: {error.message}</div>;

  const keys = (data?.apiKeys ?? []).filter(
    (k: { account?: unknown }) => !k.account,
  );

  return (
    <Card title="Org Admin Token">
      {createdKey && (
        <div class="mb-4 p-4 bg-emerald-900/30 border border-emerald-700 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <span class="text-emerald-300 text-sm font-medium">
              Token created! Copy it now -- it won't be shown again.
            </span>
            <button
              onClick={() => setCreatedKey(null)}
              class="text-slate-400 hover:text-white text-sm"
            >
              Dismiss
            </button>
          </div>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-slate-900 text-emerald-200 px-3 py-2 rounded font-mono text-sm break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={() => handleCopy(createdKey)}
              class="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded transition-colors flex-shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div class="flex gap-2 mb-4">
        <input
          type="text"
          value={newKeyName}
          onInput={(e: Event) =>
            setNewKeyName((e.target as HTMLInputElement).value)
          }
          placeholder="Token name (optional)"
          class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          {creating ? "Creating..." : "Create Token"}
        </button>
      </div>
      {createError && (
        <div class="mb-4 text-red-400 text-sm">{createError}</div>
      )}

      {keys.length === 0 ? (
        <div class="text-slate-500 text-center py-4">
          No org admin tokens yet. Create one above to get started.
        </div>
      ) : (
        <div class="space-y-2">
          {keys.map(
            (k: {
              id: string;
              prefix: string;
              name: string;
              createdAt: number;
              lastUsedAt?: number;
            }) => (
              <div
                key={k.id}
                class="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700"
              >
                <div class="flex items-center gap-2">
                  <span class="text-white text-sm font-medium">{k.name}</span>
                  <span class="text-slate-500 text-xs font-mono">
                    {k.prefix}...
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs text-slate-500">
                    {k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={deletingId === k.id}
                    class="text-xs text-red-400 hover:text-red-300 disabled:text-slate-600 transition-colors"
                  >
                    {deletingId === k.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </Card>
  );
};

const MembersSection = ({
  orgId,
  userToken,
  currentUserId,
}: {
  orgId: string;
  userToken: string;
  currentUserId: string;
}) => {
  const { isLoading, data } = useQuery({
    organizations: {
      $: { where: { id: orgId } },
      members: {},
      billingUser: {},
    },
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const org = data?.organizations?.[0];
  const members = org?.members ?? [];
  // @ts-ignore billingUser from query
  const billingUserId = org?.billingUser?.id;
  const isBilling = currentUserId === billingUserId;

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/v1/members`, {
        method: "POST",
        headers: apiHeaders(userToken, orgId),
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to invite member");
      }
      setInviteSuccess(`${email} added to org`);
      setInviteEmail("");
      setTimeout(() => setInviteSuccess(null), 3000);
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`${API_BASE}/v1/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}`, "X-Org-Id": orgId },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to remove member");
      }
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) return <div class="text-slate-400">Loading members...</div>;

  return (
    <Card title="Team Members">
      {/* Invite form */}
      <div class="flex gap-2 mb-4">
        <input
          type="email"
          value={inviteEmail}
          onInput={(e: Event) =>
            setInviteEmail((e.target as HTMLInputElement).value)
          }
          placeholder="Email address to invite"
          class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleInvite}
          disabled={inviting || !inviteEmail.trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          {inviting ? "Inviting..." : "Invite"}
        </button>
      </div>
      {inviteError && <div class="mb-3 text-red-400 text-sm">{inviteError}</div>}
      {inviteSuccess && (
        <div class="mb-3 text-emerald-400 text-sm">{inviteSuccess}</div>
      )}

      {/* Member list */}
      <div class="space-y-2">
        {members.map((m: { id: string; email: string }) => (
          <div
            key={m.id}
            class="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700"
          >
            <div class="flex items-center gap-2">
              <span class="text-white text-sm">{m.email}</span>
              {m.id === billingUserId && (
                <span class="text-xs px-2 py-0.5 bg-amber-900/50 text-amber-300 rounded">
                  billing
                </span>
              )}
              {m.id === currentUserId && (
                <span class="text-xs text-slate-500">(you)</span>
              )}
            </div>
            {isBilling && m.id !== billingUserId && (
              <button
                onClick={() => handleRemove(m.id)}
                disabled={removingId === m.id}
                class="text-xs text-red-400 hover:text-red-300 disabled:text-slate-600 transition-colors"
              >
                {removingId === m.id ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

const OrgSwitcher = ({
  orgs,
  selectedOrgId,
  onSelect,
  onCreateOrg,
  creatingOrg,
  userToken,
}: {
  orgs: { id: string; name: string }[];
  selectedOrgId: string | null;
  onSelect: (orgId: string) => void;
  onCreateOrg: () => void;
  creatingOrg: boolean;
  userToken: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  if (orgs.length === 0) return null;

  const currentOrg = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0];

  const startEdit = () => {
    setEditName(currentOrg.name);
    setEditing(true);
  };

  const saveRename = async () => {
    const name = editName.trim();
    if (!name || name === currentOrg.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/v1/organizations`, {
        method: "PATCH",
        headers: apiHeaders(userToken, currentOrg.id),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to rename");
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div class="flex items-center gap-3">
      {orgs.length > 1 ? (
        <select
          value={selectedOrgId ?? ""}
          onChange={(e: Event) =>
            onSelect((e.target as HTMLSelectElement).value)
          }
          class="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      ) : editing ? (
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={editName}
            onInput={(e: Event) =>
              setEditName((e.target as HTMLInputElement).value)
            }
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") setEditing(false);
            }}
            class="bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-lg px-3 py-1 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={saveRename}
            disabled={saving}
            class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            {saving ? "..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <h1
          class="text-2xl font-bold text-white cursor-pointer hover:text-slate-300 transition-colors"
          onClick={startEdit}
          title="Click to rename"
        >
          {orgs[0].name}
        </h1>
      )}
      {!editing && (
        <button
          onClick={onCreateOrg}
          disabled={creatingOrg}
          class="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-300 rounded-lg transition-colors"
        >
          {creatingOrg ? "Creating..." : "+ New Org"}
        </button>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);

  const { isLoading, data } = useQuery({
    organizations: {
      $: { where: { "members.id": user?.id ?? "" } },
      billingUser: {},
    },
  });

  const orgs = data?.organizations ?? [];

  // Auto-select first org if none selected
  const activeOrgId = selectedOrgId && orgs.some((o: { id: string }) => o.id === selectedOrgId)
    ? selectedOrgId
    : orgs[0]?.id ?? null;

  const handleCreateOrg = async () => {
    if (!user?.refresh_token) return;
    const name = newOrgName.trim() || `${user.email}'s Org`;
    setCreatingOrg(true);
    setOrgError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.refresh_token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create organization");
      }
      const { data: orgData } = await res.json();
      setSelectedOrgId(orgData.id);
      setShowNewOrgForm(false);
      setNewOrgName("");
    } catch (e: unknown) {
      setOrgError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreatingOrg(false);
    }
  };

  if (isLoading) {
    return (
      <div class="flex items-center justify-center h-64">
        <div class="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  // No orgs yet -- show welcome
  if (orgs.length === 0) {
    return (
      <div class="text-center py-16">
        <h1 class="text-2xl font-bold text-white mb-2">Welcome to AgentMail</h1>
        <p class="text-slate-400 mb-6">
          Set up your organization to start creating email accounts for your AI
          agents.
        </p>
        <div class="flex items-center justify-center gap-2 mb-4">
          <input
            type="text"
            value={newOrgName}
            onInput={(e: Event) =>
              setNewOrgName((e.target as HTMLInputElement).value)
            }
            placeholder="Organization name"
            class="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-4 py-3 placeholder-slate-500 focus:border-blue-500 focus:outline-none w-64"
          />
          <button
            onClick={handleCreateOrg}
            disabled={creatingOrg}
            class="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
          >
            {creatingOrg ? "Setting up..." : "Get Started"}
          </button>
        </div>
        {orgError && (
          <div class="mt-4 text-red-400 text-sm">{orgError}</div>
        )}
      </div>
    );
  }

  const userToken = user?.refresh_token ?? "";

  return (
    <div class="space-y-6">
      <div>
        <OrgSwitcher
          orgs={orgs}
          selectedOrgId={activeOrgId}
          onSelect={setSelectedOrgId}
          onCreateOrg={() => setShowNewOrgForm(!showNewOrgForm)}
          creatingOrg={creatingOrg}
        />
        <p class="text-slate-400 text-sm mt-1">
          Dashboard &middot; Signed in as {user?.email}
        </p>
      </div>

      {showNewOrgForm && (
        <Card title="Create Organization">
          <div class="flex gap-2">
            <input
              type="text"
              value={newOrgName}
              onInput={(e: Event) =>
                setNewOrgName((e.target as HTMLInputElement).value)
              }
              placeholder="Organization name"
              class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleCreateOrg}
              disabled={creatingOrg}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
            >
              {creatingOrg ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowNewOrgForm(false)}
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
          {orgError && <div class="mt-2 text-red-400 text-sm">{orgError}</div>}
        </Card>
      )}

      {activeOrgId && (
        <>
          <KarmaSection orgId={activeOrgId} />
          <AccountsList orgId={activeOrgId} userToken={userToken} />
          <RecentMessages orgId={activeOrgId} />
          <MembersSection
            orgId={activeOrgId}
            userToken={userToken}
            currentUserId={user?.id ?? ""}
          />
          <ApiKeySection orgId={activeOrgId} userToken={userToken} />
        </>
      )}
    </div>
  );
};

export { Dashboard };
