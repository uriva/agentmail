import { id, init } from "@instantdb/admin";
import schema from "../instant.schema.ts";

const db = init({
  appId: Deno.env.get("INSTANT_APP_ID")!,
  adminToken: Deno.env.get("INSTANT_ADMIN_TOKEN")!,
  schema,
});

export { db, id };
