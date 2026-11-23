/**
 * @packageDocumentation
 * Health-check endpoint used by Docker, the frontend status indicator and
 * manual diagnostics.
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

/** Maximum time (ms) the database probe may take before it is reported as down. */
const DB_PROBE_TIMEOUT_MS = 2000;

/** Connectivity state of a single dependency. */
export type DependencyStatus = "up" | "down";

/** JSON body returned by `GET /api/health`. */
export interface HealthResponse {
  /** `ok` when every dependency is up, `degraded` otherwise. */
  status: "ok" | "degraded";
  /** PostgreSQL connectivity. */
  database: DependencyStatus;
  /** Round-trip time of the database probe in milliseconds. */
  databaseLatencyMs: number | null;
  /** Process uptime in seconds. */
  uptimeSeconds: number;
  /** ISO-8601 timestamp of the check. */
  timestamp: string;
}

/**
 * Executes a trivial query (`SELECT 1`) to verify the database connection.
 *
 * @returns Round-trip latency in milliseconds.
 * @throws When the query fails or exceeds {@link DB_PROBE_TIMEOUT_MS}.
 */
async function probeDatabase(): Promise<number> {
  const startedAt = performance.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Database probe timed out")), DB_PROBE_TIMEOUT_MS);
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return Math.round(performance.now() - startedAt);
  } finally {
    clearTimeout(timer);
  }
}

/** Router exposing `GET /health` (mounted under `/api`). */
export const healthRouter: Router = Router();

/**
 * `GET /api/health` — reports service and database status.
 *
 * Responds with HTTP 200 when the database is reachable and HTTP 503 otherwise.
 */
healthRouter.get("/health", async (_req, res) => {
  let database: DependencyStatus = "up";
  let databaseLatencyMs: number | null = null;

  try {
    databaseLatencyMs = await probeDatabase();
  } catch (error) {
    database = "down";
    console.warn("[health] Database probe failed:", error instanceof Error ? error.message : error);
  }

  const body: HealthResponse = {
    status: database === "up" ? "ok" : "degraded",
    database,
    databaseLatencyMs,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  res.status(database === "up" ? 200 : 503).json(body);
});
