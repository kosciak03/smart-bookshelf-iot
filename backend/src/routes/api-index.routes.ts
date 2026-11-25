/**
 * @packageDocumentation
 * `GET /api` — API entry point listing the available endpoints.
 */
import { readFileSync } from "node:fs";
import { Router } from "express";

/** Package metadata read once at startup (works from both `src/` and `dist/`). */
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

/** Single entry of the endpoint list. */
export interface EndpointInfo {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
}

/** JSON body returned by `GET /api`. */
export interface ApiIndexResponse {
  name: string;
  version: string;
  endpoints: EndpointInfo[];
}

/** Endpoints exposed by the API (keep in sync when adding routes). */
const ENDPOINTS: EndpointInfo[] = [
  { method: "GET", path: "/api", description: "This endpoint list" },
  { method: "GET", path: "/api/health", description: "Service and database status" },
  {
    method: "GET",
    path: "/api/books",
    description:
      "List books (query: q, status, location, minRating, tag, sort incl. relevance, order, page, pageSize)",
  },
  { method: "GET", path: "/api/books/:id", description: "Get a single book" },
  { method: "POST", path: "/api/books", description: "Create a book" },
  { method: "PATCH", path: "/api/books/:id", description: "Update a book partially" },
  { method: "DELETE", path: "/api/books/:id", description: "Delete a book" },
  { method: "POST", path: "/api/books/import", description: "Create a book from ISBN metadata ({ isbn, ...overrides })" },
  { method: "GET", path: "/api/isbn/:isbn", description: "Look up book metadata by ISBN (Google Books, Open Library)" },
];

/** Router exposing `GET /` (mounted under `/api`). */
export const apiIndexRouter: Router = Router();

apiIndexRouter.get("/", (_req, res) => {
  const body: ApiIndexResponse = { name: "Smart Bookshelf API", version: packageJson.version, endpoints: ENDPOINTS };
  res.json(body);
});
