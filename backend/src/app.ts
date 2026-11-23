/**
 * @packageDocumentation
 * Express application factory.
 *
 * Kept separate from the server bootstrap (`index.ts`) so that the app can be
 * instantiated in integration tests without binding to a TCP port.
 */
import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { booksRouter } from "./modules/books/book.routes.js";
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
  app.use("/api/books", booksRouter);

  app.use(notFoundHandler);
  // Express 5 forwards rejected promises from async handlers to this middleware.
  app.use(errorHandler);

  return app;
}
