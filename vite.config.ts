import deno from "@deno/vite-plugin";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: "./web",
  envDir: "..",
  server: { port: 3000 },
  plugins: [preact(), deno()],
  build: { sourcemap: true },
  resolve: {
    alias: {
      "@instantdb/react": "@instantdb/react",
      "@instantdb/core": "@instantdb/core",
      preact: "preact",
      "@preact/signals": "@preact/signals",
    },
  },
});
