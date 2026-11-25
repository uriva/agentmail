type SqlCursorLike = {
  toArray: () => Array<Record<string, unknown>>;
};

type SqlStorageLike = {
  exec: (query: string, ...bindings: unknown[]) => SqlCursorLike;
};

type DurableObjectStateLike = {
  storage: {
    sql: SqlStorageLike;
  };
};

export type SecurityGuardNamespace = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
};

export class SecurityGuardDO {
  private readonly sql: SqlStorageLike;
  private initialized = false;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.sql = state.storage.sql;
  }

  private ensureSchema(): void {
    if (this.initialized) return;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS locks (
        key TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rate_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_events_key_ts ON rate_events(key, ts);
      CREATE TABLE IF NOT EXISTS replay_ids (
        key TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );
    `);
    this.initialized = true;
  }

  async fetch(req: Request): Promise<Response> {
    this.ensureSchema();
    const url = new URL(req.url);
    const now = Date.now();
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (url.pathname === "/lock/acquire") {
      const key = String(body.key ?? "");
      const owner = String(body.owner ?? "");
      const ttlMs = Math.max(1_000, Number(body.ttlMs ?? 30_000));
      if (!key || !owner) {
        return Response.json({ acquired: false }, { status: 400 });
      }
      this.sql.exec(
        "DELETE FROM locks WHERE key = ? AND expires_at <= ?",
        key,
        now,
      );
      const existing = this.sql
        .exec("SELECT owner FROM locks WHERE key = ?", key)
        .toArray();
      if (existing.length > 0 && existing[0]?.owner !== owner) {
        return Response.json({ acquired: false });
      }
      this.sql.exec(
        "INSERT OR REPLACE INTO locks (key, owner, expires_at) VALUES (?, ?, ?)",
        key,
        owner,
        now + ttlMs,
      );
      return Response.json({ acquired: true });
    }

    if (url.pathname === "/lock/release") {
      const key = String(body.key ?? "");
      const owner = String(body.owner ?? "");
      if (key && owner) {
        this.sql.exec(
          "DELETE FROM locks WHERE key = ? AND owner = ?",
          key,
          owner,
        );
      }
      return Response.json({ released: true });
    }

    if (url.pathname === "/rate/check") {
      const key = String(body.key ?? "");
      const maxRequests = Math.max(1, Number(body.maxRequests ?? 1));
      const windowMs = Math.max(1_000, Number(body.windowMs ?? 60_000));
      if (!key) {
        return Response.json({ allowed: false }, { status: 400 });
      }
      const cutoff = now - windowMs;
      this.sql.exec(
        "DELETE FROM rate_events WHERE key = ? AND ts <= ?",
        key,
        cutoff,
      );
      const rows = this.sql
        .exec("SELECT COUNT(*) AS cnt FROM rate_events WHERE key = ?", key)
        .toArray();
      const count = Number(rows[0]?.cnt ?? 0);
      if (count >= maxRequests) {
        return Response.json({ allowed: false });
      }
      this.sql.exec(
        "INSERT INTO rate_events (key, ts) VALUES (?, ?)",
        key,
        now,
      );
      return Response.json({ allowed: true });
    }

    if (url.pathname === "/replay/mark") {
      const eventKey = String(body.eventKey ?? "");
      const ttlMs = Math.max(1_000, Number(body.ttlMs ?? 600_000));
      if (!eventKey) {
        return Response.json({ fresh: false }, { status: 400 });
      }
      this.sql.exec("DELETE FROM replay_ids WHERE expires_at <= ?", now);
      const existing = this.sql
        .exec("SELECT key FROM replay_ids WHERE key = ?", eventKey)
        .toArray();
      if (existing.length > 0) {
        return Response.json({ fresh: false });
      }
      this.sql.exec(
        "INSERT INTO replay_ids (key, expires_at) VALUES (?, ?)",
        eventKey,
        now + ttlMs,
      );
      return Response.json({ fresh: true });
    }

    return new Response("Not found", { status: 404 });
  }
}
