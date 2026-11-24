/**
 * @packageDocumentation
 * HTTP error types and the common error response format.
 *
 * Services throw these errors; the central error handler converts them into
 * JSON responses of the shape {@link ErrorResponse}.
 */

/** Machine-readable error codes returned by the API. */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "NOT_FOUND"
  | "ISBN_NOT_FOUND"
  | "ISBN_CONFLICT"
  | "SLOT_CONFLICT"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "METADATA_SOURCE_UNAVAILABLE"
  | "INTERNAL_ERROR";

/** Single field-level problem reported with a `VALIDATION_ERROR`. */
export interface ErrorDetail {
  /** Location of the invalid value, e.g. `body.pagesRead` or `query.page`. */
  path: string;
  message: string;
}

/** JSON body of every error response. */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

/**
 * Base class for errors that map directly to an HTTP status code.
 */
export class HttpError extends Error {
  /**
   * @param status - HTTP status code.
   * @param code - Machine-readable error code.
   * @param message - Human-readable description.
   * @param details - Optional field-level details.
   */
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 — request data failed validation that a schema could not express. */
export class ValidationError extends HttpError {
  /**
   * @param message - Summary of the problem.
   * @param details - Field-level details.
   */
  constructor(message: string, details?: ErrorDetail[]) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

/** 404 — the requested resource does not exist. */
export class NotFoundError extends HttpError {
  /**
   * @param resource - Resource name, e.g. `Book`.
   * @param id - Identifier that was looked up.
   */
  constructor(resource: string, id: string) {
    super(404, "NOT_FOUND", `${resource} with id '${id}' was not found`);
  }
}

/** 409 — the request conflicts with the current state (e.g. a duplicate ISBN). */
export class ConflictError extends HttpError {
  /**
   * @param code - Specific conflict code.
   * @param message - Human-readable description.
   */
  constructor(code: Extract<ErrorCode, "ISBN_CONFLICT" | "SLOT_CONFLICT" | "CONFLICT">, message: string) {
    super(409, code, message);
  }
}

/** 404 — no external metadata source knows the requested ISBN. */
export class IsbnNotFoundError extends HttpError {
  /**
   * @param isbn - Normalized ISBN-13 that was looked up.
   * @param details - Sources that could not be queried (the result may be incomplete).
   */
  constructor(isbn: string, details?: ErrorDetail[]) {
    super(404, "ISBN_NOT_FOUND", `No book metadata found for ISBN ${isbn}`, details);
  }
}

/** 502 — external metadata sources failed, so the result is unknown. */
export class MetadataSourceUnavailableError extends HttpError {
  /**
   * @param isbn - Normalized ISBN-13 that was looked up.
   * @param details - One entry per failed source.
   */
  constructor(isbn: string, details: ErrorDetail[]) {
    super(502, "METADATA_SOURCE_UNAVAILABLE", `Book metadata sources are unavailable for ISBN ${isbn}`, details);
  }
}
