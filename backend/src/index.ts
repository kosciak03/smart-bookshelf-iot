/**
 * @packageDocumentation
 * Server entry point: starts the HTTP server and handles graceful shutdown.
 */
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[server] Smart Bookshelf API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Closes the HTTP server and the database connection pool before exiting.
 *
 * @param signal - The POSIX signal that triggered the shutdown.
 */
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[server] Received ${signal}, shutting down...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
