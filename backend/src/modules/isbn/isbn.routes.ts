/**
 * @packageDocumentation
 * `GET /api/isbn/:isbn` — looks up book metadata in external sources without
 * saving anything (used by the "add book" form to preview data).
 *
 * Responses:
 * - 200 `{ data: BookMetadata, meta: { cached } }`
 * - 400 `VALIDATION_ERROR` — invalid ISBN format or checksum
 * - 404 `ISBN_NOT_FOUND` — no source knows the ISBN
 * - 502 `METADATA_SOURCE_UNAVAILABLE` — every source failed
 */
import { Router } from "express";
import { z } from "zod";
import { parseRequest } from "../../lib/validate.js";
import { isbnSchema } from "../books/book.schemas.js";
import { isbnLookupService } from "./isbn.service.js";

/** Route parameters: ISBN-10 or ISBN-13, hyphens and spaces allowed. */
const isbnParamsSchema = z.object({ isbn: isbnSchema });

/** Router for `/api/isbn`. */
export const isbnRouter: Router = Router();

isbnRouter.get("/:isbn", async (req, res) => {
  const { isbn } = parseRequest(isbnParamsSchema, req.params, "params");
  const { metadata, cached } = await isbnLookupService.lookup(isbn);
  res.json({ data: metadata, meta: { cached } });
});
