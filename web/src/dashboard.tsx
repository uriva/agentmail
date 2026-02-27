import { useState } from "preact/hooks";
import { useQuery, useAuth } from "./db.ts";

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

const AccountsList = ({ orgId }: { orgId: string }) => {
  const { isLoading, error, data } = useQuery({
    accounts: {
      $: { where: { "organization.id": orgId } },
      messages: {},
      webhooks: {},
    },
  });

  if (isLoading) return <div class="text-slate-400">Loading accounts...</div>;
  if (error)
    return (
      <div class="text-red-400">Error loading accounts: {error.message}</div>
    );

  const accounts = data?.accounts ?? [];

  if (accounts.length === 0) {
    return (
      <Card title="Email Accounts">
        <div class="text-slate-500 text-center py-8">
          No email accounts yet. Create one via the API.
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Email Accounts (${accounts.length})`}>
      <div class="space-y-3">
        {accounts.map(
          (account: {
            id: string;
            address: string;
            displayName?: string;
            messages: { id: string; direction: string; timestamp: number }[];
            webhooks: { id: string }[];
            createdAt: number;
          }) => {
            const inbound = account.messages.filter(
              (m) => m.direction === "inbound",
            ).length;
            const outbound = account.messages.filter(
              (m) => m.direction === "outbound",
            ).length;
            return (
              <div
                key={account.id}
                class="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
              >
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
                  <span class="text-xs text-slate-500">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div class="flex gap-4 text-sm">
                  <span class="text-slate-400">
                    <span class="text-blue-400 font-medium">{inbound}</span>{" "}
                    received
                  </span>
                  <span class="text-slate-400">
                    <span class="text-emerald-400 font-medium">{outbound}</span>{" "}
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
            );
          },
        )}
      </div>
    </Card>
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

// @ts-ignore: Vite injects import.meta.env at build time
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";

const ApiKeySection = ({
  orgId,
  userToken,
}: {
  orgId: string;
  userToken: string;
}) => {
  const { isLoading, error, data } = useQuery({
    apiKeys: { $: { where: { "organization.id": orgId } } },
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
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
        headers: { Authorization: `Bearer ${userToken}` },
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
      // fallback: select a hidden input
    }
  };

  if (isLoading) return <div class="text-slate-400">Loading API keys...</div>;
  if (error) return <div class="text-red-400">Error: {error.message}</div>;

  const keys = data?.apiKeys ?? [];

  return (
    <Card title={`API Keys (${keys.length})`}>
      {/* Newly created key banner */}
      {createdKey && (
        <div class="mb-4 p-4 bg-emerald-900/30 border border-emerald-700 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <span class="text-emerald-300 text-sm font-medium">
              API key created! Copy it now — it won't be shown again.
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

      {/* Create form */}
      <div class="flex gap-2 mb-4">
        <input
          type="text"
          value={newKeyName}
          onInput={(e: Event) =>
            setNewKeyName((e.target as HTMLInputElement).value)
          }
          placeholder="Key name (optional)"
          class="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          {creating ? "Creating..." : "Create API Key"}
        </button>
      </div>
      {createError && (
        <div class="mb-4 text-red-400 text-sm">{createError}</div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div class="text-slate-500 text-center py-4">
          No API keys yet. Create one above to get started.
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
                <div>
                  <span class="text-white text-sm font-medium">{k.name}</span>
                  <span class="text-slate-500 text-xs ml-2 font-mono">
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

const Dashboard = () => {
  const { user } = useAuth();
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Query organizations linked to the authenticated user
  const { isLoading, data } = useQuery({
    organizations: {
      $: { where: { "members.id": user?.id ?? "" } },
    },
  });

  const handleCreateOrg = async () => {
    if (!user?.refresh_token) return;
    setCreatingOrg(true);
    setOrgError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.refresh_token}`,
        },
        body: JSON.stringify({ name: `${user.email}'s Org` }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create organization");
      }
      // InstantDB reactive query will pick up the new org automatically
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

  const org = data?.organizations?.[0];
  if (!org) {
    return (
      <div class="text-center py-16">
        <h1 class="text-2xl font-bold text-white mb-2">Welcome to AgentMail</h1>
        <p class="text-slate-400 mb-6">
          Set up your organization to start creating email accounts for your AI
          agents.
        </p>
        <button
          onClick={handleCreateOrg}
          disabled={creatingOrg}
          class="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
        >
          {creatingOrg ? "Setting up..." : "Get Started"}
        </button>
        {orgError && (
          <div class="mt-4 text-red-400 text-sm">{orgError}</div>
        )}
      </div>
    );
  }

  return (
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">{org.name}</h1>
        <p class="text-slate-400 text-sm mt-1">
          Dashboard &middot; Signed in as {user?.email}
        </p>
      </div>
      <KarmaSection orgId={org.id} />
      <AccountsList orgId={org.id} />
      <RecentMessages orgId={org.id} />
      <ApiKeySection orgId={org.id} userToken={user?.refresh_token ?? ""} />
    </div>
  );
};

export { Dashboard };
