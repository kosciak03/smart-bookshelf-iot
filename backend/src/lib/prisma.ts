/**
 * @packageDocumentation
 * Shared Prisma Client instance.
 *
 * A single client is reused across the whole application so that the
 * connection pool is not exhausted by multiple instances.
 */
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/** Application-wide Prisma Client. */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
