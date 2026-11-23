/**
 * @packageDocumentation
 * Loads and validates process environment variables.
 *
 * Variables are read from `backend/.env` (if present) and then validated with
 * `zod`, so the application fails fast on startup when the configuration is
 * incomplete instead of failing later at runtime.
 */
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

/**
 * Schema describing every environment variable used by the backend.
 */
const envSchema = z.object({
  /** Runtime mode of the Node.js process. */
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** TCP port the HTTP server listens on. */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** PostgreSQL connection string consumed by Prisma. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Comma-separated list of origins allowed by CORS. */
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

/** Strongly typed, validated application configuration. */
export type Env = z.infer<typeof envSchema>;

/**
 * Parses `process.env` against {@link envSchema}.
 *
 * @returns The validated configuration object.
 * @throws Terminates the process with exit code 1 when validation fails.
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("[config] Invalid environment variables:\n" + z.prettifyError(result.error));
    process.exit(1);
  }
  return result.data;
}

/** Validated application configuration (singleton). */
export const env: Env = loadEnv();
