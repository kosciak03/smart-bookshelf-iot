/**
 * @packageDocumentation
 * Central error handling: converts every error thrown in a route into a JSON
 * response of the shape {@link ErrorResponse}.
 *
 * | Source                               | Status | Code                |
 * | ------------------------------------ | ------ | ------------------- |
 * | {@link HttpError} subclasses         | own    | own                 |
 * | `ZodError` (fallback)                | 400    | `VALIDATION_ERROR`  |
 * | Malformed JSON body                  | 400    | `INVALID_JSON`      |
 * | Body larger than the limit           | 413    | `PAYLOAD_TOO_LARGE` |
 * | Prisma P2002 (unique, `isbn`)        | 409    | `ISBN_CONFLICT`     |
 * | Prisma P2002 (unique, `slotId`)      | 409    | `SLOT_CONFLICT`     |
 * | Prisma P2002 (unique, other field)   | 409    | `CONFLICT`          |
 * | Prisma P2025 (record not found)      | 404    | `NOT_FOUND`         |
 * | Anything else                        | 500    | `INTERNAL_ERROR`    |
 */
import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { HttpError, type ErrorCode, type ErrorDetail, type ErrorResponse } from "../lib/http-errors.js";
import { zodIssuesToDetails } from "../lib/validate.js";

/**
 * Writes an error response.
 *
 * @param res - Express response.
 * @param status - HTTP status code.
 * @param code - Machine-readable error code.
 * @param message - Human-readable description.
 * @param details - Optional field-level details.
 */
function sendError(res: Response, status: number, code: ErrorCode, message: string, details?: ErrorDetail[]): void {
  const body: ErrorResponse = { error: details ? { code, message, details } : { code, message } };
  res.status(status).json(body);
}

/** Error shape produced by the `body-parser` middleware used by `express.json()`. */
interface BodyParserError {
  type: string;
  status: number;
}

/**
 * Type guard for `body-parser` errors.
 *
 * @param error - Any thrown value.
 * @returns `true` when the error comes from body parsing.
 */
function isBodyParserError(error: unknown): error is BodyParserError {
  return typeof error === "object" && error !== null && "type" in error && "status" in error;
}

/**
 * Fallback for unknown routes: responds with 404 `NOT_FOUND`.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} does not exist`);
};

/**
 * Express error-handling middleware (must be registered last).
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, 400, "VALIDATION_ERROR", "Invalid request data", zodIssuesToDetails(error.issues));
    return;
  }

  if (isBodyParserError(error)) {
    if (error.type === "entity.parse.failed") {
      sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
      return;
    }
    if (error.type === "entity.too.large") {
      sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? [];
      const fields = Array.isArray(target) ? target : [target];
      if (fields.includes("isbn")) {
        sendError(res, 409, "ISBN_CONFLICT", "A book with this ISBN already exists");
      } else if (fields.includes("slotId")) {
        sendError(res, 409, "SLOT_CONFLICT", "This shelf slot is already assigned to another book");
      } else {
        sendError(res, 409, "CONFLICT", `Unique constraint violated on: ${fields.join(", ")}`);
      }
      return;
    }
    if (error.code === "P2025") {
      sendError(res, 404, "NOT_FOUND", "Requested record was not found");
      return;
    }
  }

  console.error("[error] Unhandled error:", error);
  const message = env.NODE_ENV === "production" || !(error instanceof Error) ? "Internal Server Error" : error.message;
  sendError(res, 500, "INTERNAL_ERROR", message);
};
