/**
 * @packageDocumentation
 * REST endpoints for the book catalogue (mounted under `/api/books`).
 *
 * | Method | Path   | Success | Response body                      |
 * | ------ | ------ | ------- | ---------------------------------- |
 * | GET    | `/`    | 200     | `{ data: Book[], meta: PageMeta }` |
 * | GET    | `/:id` | 200     | `{ data: Book }`                   |
 * | POST   | `/`    | 201     | `{ data: Book }` + `Location`      |
 * | POST   | `/import` | 201  | `{ data: Book, meta: { source, cached } }` |
 * | PATCH  | `/:id` | 200     | `{ data: Book }`                   |
 * | DELETE | `/:id` | 204     | —                                  |
 *
 * `GET /` query parameters (all optional):
 * - `q` – search phrase (title, author, publisher, ISBN, tag; typo- and diacritic-tolerant),
 * - `status`, `location` – one or more enum values (`a,b` or repeated keys),
 * - `minRating` – 1–5, `tag` – required tags (all must match),
 * - `sort` – `relevance` (default with `q`), `title`, `author`, `createdAt`
 *   (default), `updatedAt`, `rating`, `publishedYear`; `order` – `asc`/`desc`
 *   (default `asc` for text fields, `desc` otherwise),
 * - `page`, `pageSize` – pagination (`pageSize` ≤ 100).
 *
 * `POST /`, `POST /import` and `PATCH /:id` apply the reading rules from
 * `book-rules.ts` (progress → status, status change → reading dates, rating
 * only for READING/READ books).
 *
 * Errors use the common format described in `lib/http-errors.ts`.
 */
import { Router } from "express";
import { parseRequest } from "../../lib/validate.js";
import { importBook } from "./book-import.service.js";
import {
  bookIdParamsSchema,
  createBookSchema,
  importBookSchema,
  listBooksQuerySchema,
  updateBookSchema,
} from "./book.schemas.js";
import { createBook, deleteBook, getBook, listBooks, updateBook } from "./book.service.js";

/** Router for `/api/books`. */
export const booksRouter: Router = Router();

booksRouter.get("/", async (req, res) => {
  const query = parseRequest(listBooksQuerySchema, req.query, "query");
  res.json(await listBooks(query));
});

booksRouter.get("/:id", async (req, res) => {
  const { id } = parseRequest(bookIdParamsSchema, req.params, "params");
  res.json({ data: await getBook(id) });
});

booksRouter.post("/", async (req, res) => {
  const input = parseRequest(createBookSchema, req.body, "body");
  const book = await createBook(input);
  res.status(201).location(`${req.baseUrl}/${book.id}`).json({ data: book });
});

booksRouter.post("/import", async (req, res) => {
  const input = parseRequest(importBookSchema, req.body, "body");
  const { book, source, cached } = await importBook(input, req.body as Record<string, unknown>);
  res.status(201).location(`${req.baseUrl}/${book.id}`).json({ data: book, meta: { source, cached } });
});

booksRouter.patch("/:id", async (req, res) => {
  const { id } = parseRequest(bookIdParamsSchema, req.params, "params");
  const patch = parseRequest(updateBookSchema, req.body, "body");
  res.json({ data: await updateBook(id, patch) });
});

booksRouter.delete("/:id", async (req, res) => {
  const { id } = parseRequest(bookIdParamsSchema, req.params, "params");
  await deleteBook(id);
  res.status(204).end();
});
