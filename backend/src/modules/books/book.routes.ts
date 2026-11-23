/**
 * @packageDocumentation
 * REST endpoints for the book catalogue (mounted under `/api/books`).
 *
 * | Method | Path   | Success | Response body                      |
 * | ------ | ------ | ------- | ---------------------------------- |
 * | GET    | `/`    | 200     | `{ data: Book[], meta: PageMeta }` |
 * | GET    | `/:id` | 200     | `{ data: Book }`                   |
 * | POST   | `/`    | 201     | `{ data: Book }` + `Location`      |
 * | PATCH  | `/:id` | 200     | `{ data: Book }`                   |
 * | DELETE | `/:id` | 204     | —                                  |
 *
 * Errors use the common format described in `lib/http-errors.ts`.
 */
import { Router } from "express";
import { parseRequest } from "../../lib/validate.js";
import { bookIdParamsSchema, createBookSchema, listBooksQuerySchema, updateBookSchema } from "./book.schemas.js";
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
