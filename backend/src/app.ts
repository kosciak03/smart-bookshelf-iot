/**
 * @packageDocumentation
 * Express application factory.
 *
 * Kept separate from the server bootstrap (`index.ts`) so that the app can be
 * instantiated in integration tests without binding to a TCP port.
 */
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.routes.js";

/**
 * Creates and configures the Express application.
 *
 * @returns A ready-to-listen Express instance.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", healthRouter);

  // Unknown API routes.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  // Centralized error handler (Express 5 forwards rejected promises here).
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[app] Unhandled error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}
