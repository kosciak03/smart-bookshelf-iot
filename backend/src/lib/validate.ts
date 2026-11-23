/**
 * @packageDocumentation
 * Helpers for validating request input with `zod`.
 */
import type { z } from "zod";
import { ValidationError, type ErrorDetail } from "./http-errors.js";

/** Part of the HTTP request being validated (used as the error path prefix). */
export type RequestLocation = "body" | "query" | "params";

/**
 * Converts zod issues into API error details, prefixing each path with the
 * request location (e.g. `body.pagesRead`).
 *
 * @param issues - Issues reported by zod.
 * @param location - Optional request location prefix.
 * @returns Error details suitable for an error response.
 */
export function zodIssuesToDetails(issues: readonly z.core.$ZodIssue[], location?: RequestLocation): ErrorDetail[] {
  return issues.map((issue) => ({
    path: [...(location ? [location] : []), ...issue.path.map(String)].join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Parses request data with a zod schema.
 *
 * @param schema - Schema describing the expected data.
 * @param data - Raw input (`req.body`, `req.query` or `req.params`).
 * @param location - Which part of the request is validated.
 * @returns The parsed (and transformed) data.
 * @throws {@link ValidationError} (HTTP 400) when the data is invalid.
 */
export function parseRequest<S extends z.ZodType>(schema: S, data: unknown, location: RequestLocation): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(`Invalid request ${location}`, zodIssuesToDetails(result.error.issues, location));
  }
  return result.data;
}
