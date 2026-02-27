import { init } from "@instantdb/react";
import schema from "../../instant.schema.ts";

// @ts-ignore: Vite injects import.meta.env at build time
const INSTANT_APP_ID: string = import.meta.env.VITE_INSTANT_APP_ID ?? "";

const db = init({
  appId: INSTANT_APP_ID,
  schema,
  devtool: false,
});

export const { useQuery, tx, transact, useAuth, auth } = db;
export { db };
