import { pipe } from "gamla";

const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com";
const POSTHOG_API_KEY = Deno.env.get("POSTHOG_API_KEY") ?? "";

const captureEvent = (
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> =>
  POSTHOG_API_KEY
    ? fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "agentmail-api" },
        timestamp: new Date().toISOString(),
      }),
    }).then(() => undefined)
    : Promise.resolve();

const trackOrgEvent = (orgId: string, event: string) =>
  pipe(
    (properties: Record<string, unknown>) =>
      captureEvent(orgId, event, { ...properties, orgId }),
  );

export { captureEvent, trackOrgEvent };
