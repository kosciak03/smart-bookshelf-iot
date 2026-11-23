/**
 * @packageDocumentation
 * Vitest global setup: recreates the test database schema from the Prisma
 * migrations once per test run.
 */
import { execSync } from "node:child_process";
import { TEST_DATABASE_URL, assertTestDatabase } from "./test-database.js";

/**
 * Drops all data in the test database and re-applies every migration.
 */
export default function setup(): void {
  assertTestDatabase(TEST_DATABASE_URL);
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: ["ignore", "ignore", "inherit"],
  });
}
