import { id, init } from "@instantdb/admin";
import { createMockDb } from "@uri/instantdb-mock";
import schema from "../instant.schema.ts";

type DbInstance = ReturnType<typeof init<typeof schema>>;
const dbCell: DbInstance[] = [];

const createDbInstance = (): DbInstance => {
  if (Deno.env.get("DENO_ENV") === "test") {
    return createMockDb(schema) as unknown as DbInstance;
  }
  const appId = Deno.env.get("INSTANT_APP_ID");
  const adminToken = Deno.env.get("INSTANT_ADMIN_TOKEN");
  if (!appId || !adminToken) {
    throw new Error(
      "INSTANT_APP_ID and INSTANT_ADMIN_TOKEN must be configured",
    );
  }
  return init({ appId, adminToken, schema });
};

const getDb = (): DbInstance => dbCell[0] ?? (dbCell[0] = createDbInstance());

const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { db, id };
