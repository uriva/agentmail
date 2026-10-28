import { handleRequest, isApiPath } from "./main.ts";
import { runBillingRenewalCheck } from "./services/billingCron.ts";
import { waitBackgroundTasks } from "./services/posthog.ts";

// deno-lint-ignore no-explicit-any
const syncEnv = (env: Record<string, any>) => {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  g.process ??= { env: {} };
  g.process.env ??= {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") {
      g.process.env[k] = v;
    }
  }
};

export default {
  // deno-lint-ignore no-explicit-any
  async fetch(req: Request, env: Record<string, any>, ctx: any) {
    syncEnv(env);
    const response = await handleRequest(req);
    ctx?.waitUntil?.(waitBackgroundTasks());
    if (response.status === 404) {
      const url = new URL(req.url);
      if (
        !isApiPath(url.pathname) &&
        (req.method === "GET" || req.method === "HEAD") &&
        env.ASSETS
      ) {
        return await env.ASSETS.fetch(req);
      }
    }
    return response;
  },
  // deno-lint-ignore no-explicit-any
  async scheduled(_controller: any, env: Record<string, any>, ctx: any) {
    syncEnv(env);
    const p = runBillingRenewalCheck().finally(() => waitBackgroundTasks());
    ctx?.waitUntil?.(p);
    await p;
  },
};
