/**
 * @packageDocumentation
 * `GET /api/stats` — reading statistics of the library.
 *
 * Query: `year` (optional, 1900–2100) — year of the monthly breakdown;
 * defaults to the current year in `APP_TIMEZONE`.
 *
 * Response: 200 `{ data: LibraryStats }` (see `stats.service.ts`).
 */
import { Router } from "express";
import { z } from "zod";
import { parseRequest } from "../../lib/validate.js";
import { currentYear, getLibraryStats } from "./stats.service.js";

/** Query string of `GET /api/stats`. */
export const statsQuerySchema = z.strictObject({
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

/** Router for `/api/stats`. */
export const statsRouter: Router = Router();

statsRouter.get("/", async (req, res) => {
  const { year = currentYear() } = parseRequest(statsQuerySchema, req.query, "query");
  res.json({ data: await getLibraryStats(year) });
});
