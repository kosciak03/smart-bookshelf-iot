/**
 * @packageDocumentation
 * Location of the dedicated test database and a guard that prevents tests from
 * ever running against the development database.
 */

/**
 * Connection string of the test database (`postgres-test` service).
 * Inside Docker it is provided via `TEST_DATABASE_URL`; on the host the
 * service is reachable on port 5433.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://bookshelf_test:bookshelf_test@localhost:5433/smart_bookshelf_test?schema=public";

/**
 * Throws unless the URL points to a database whose name ends with `_test`.
 *
 * @param url - Connection string to check.
 * @throws When the URL does not point to a test database.
 */
export function assertTestDatabase(url: string | undefined): void {
  const databaseName = url ? new URL(url).pathname.slice(1) : "";
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to run tests against non-test database '${databaseName || "(none)"}'.`);
  }
}
