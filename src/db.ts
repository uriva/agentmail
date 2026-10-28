import { id, init } from "@instantdb/admin";
import schema from "../instant.schema.ts";

type DbInstance = ReturnType<typeof init<typeof schema>>;
const dbCell: DbInstance[] = [];

const getDb = (): DbInstance =>
  dbCell[0] ?? (dbCell[0] = init({
    appId: Deno.env.get("INSTANT_APP_ID") ||
      "506a3595-23d3-4b99-aff3-33105ee29342",
    adminToken: Deno.env.get("INSTANT_ADMIN_TOKEN") ||
      "00000000-0000-0000-0000-000000000000",
    schema,
  }));

const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { db, id };
