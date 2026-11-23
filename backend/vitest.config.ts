/**
 * @packageDocumentation
 * Vitest configuration. Integration tests use the dedicated `postgres-test`
 * database and run sequentially because they share it.
 */
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./src/test/test-database.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
    },
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
