/**
 * @packageDocumentation
 * Integration tests for `/api/books` (Express app + test database).
 */
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma, resetDatabase } from "../../test/db.js";

const app = createApp();

/** Minimal valid body for `POST /api/books`. */
const minimalBook = { title: "Clean Code", author: "Robert C. Martin" };

/**
 * Creates a book through the API and returns its JSON representation.
 *
 * @param body - Request body (merged over {@link minimalBook}).
 * @returns The created book.
 */
async function createBook(body: Record<string, unknown> = {}): Promise<Record<string, unknown> & { id: string }> {
  const response = await request(app)
    .post("/api/books")
    .send({ ...minimalBook, ...body })
    .expect(201);
  return response.body.data;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/books", () => {
  it("creates a book with defaults and returns 201 with a Location header", async () => {
    const response = await request(app).post("/api/books").send(minimalBook).expect(201);

    expect(response.headers.location).toBe(`/api/books/${response.body.data.id}`);
    expect(response.body.data).toMatchObject({
      title: "Clean Code",
      author: "Robert C. Martin",
      isbn: null,
      status: "WANT_TO_READ",
      pagesRead: 0,
      tags: [],
      locationStatus: "UNASSIGNED",
      slot: null,
    });
  });

  it("normalizes ISBN input (hyphens, ISBN-10) and tags", async () => {
    const fromIsbn13 = await createBook({ isbn: "978-0-13-235088-4", tags: [" Programming ", "programming", "Craft"] });
    expect(fromIsbn13.isbn).toBe("9780132350884");
    expect(fromIsbn13.tags).toEqual(["programming", "craft"]);

    const fromIsbn10 = await createBook({ title: "Dune", author: "Frank Herbert", isbn: "0-441-17271-7" });
    expect(fromIsbn10.isbn).toBe("9780441172719");
  });

  it("accepts all optional fields", async () => {
    const book = await createBook({
      isbn: "9780132350884",
      description: "A handbook of agile software craftsmanship.",
      coverUrl: "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg",
      publisher: "Prentice Hall",
      publishedYear: 2008,
      pageCount: 464,
      pagesRead: 100,
      rating: 5,
      status: "READING",
      startedAt: "2026-11-01",
      finishedAt: null,
    });
    expect(book).toMatchObject({ publishedYear: 2008, pagesRead: 100, rating: 5, status: "READING" });
    expect(book.startedAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("returns 400 with field details for invalid data", async () => {
    const response = await request(app)
      .post("/api/books")
      .send({ author: "", isbn: "1234567890123", rating: 6 })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    const paths = response.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(["body.title", "body.author", "body.isbn", "body.rating"]));
  });

  it("rejects read-only shelf fields and unknown fields", async () => {
    const response = await request(app)
      .post("/api/books")
      .send({ ...minimalBook, rfidUid: "04A1B2C3", locationStatus: "ON_SHELF" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects pagesRead greater than pageCount and finishedAt before startedAt", async () => {
    const response = await request(app)
      .post("/api/books")
      .send({ ...minimalBook, pageCount: 100, pagesRead: 101, startedAt: "2026-11-10", finishedAt: "2026-11-01" })
      .expect(400);
    const paths = response.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(["body.pagesRead", "body.finishedAt"]);
  });

  it("returns 409 for a duplicate ISBN, regardless of its input format", async () => {
    await createBook({ isbn: "9780132350884" });
    const response = await request(app)
      .post("/api/books")
      .send({ ...minimalBook, isbn: "0-13-235088-2" })
      .expect(409);
    expect(response.body.error.code).toBe("ISBN_CONFLICT");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/books")
      .set("Content-Type", "application/json")
      .send('{"title": ')
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
});

describe("GET /api/books", () => {
  it("returns an empty page when there are no books", async () => {
    const response = await request(app).get("/api/books").expect(200);
    expect(response.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it("paginates and sorts results", async () => {
    for (const title of ["Charlie", "Alpha", "Bravo"]) await createBook({ title });

    const firstPage = await request(app).get("/api/books?sort=title&order=asc&pageSize=2").expect(200);
    expect(firstPage.body.data.map((book: { title: string }) => book.title)).toEqual(["Alpha", "Bravo"]);
    expect(firstPage.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

    const secondPage = await request(app).get("/api/books?sort=title&order=asc&pageSize=2&page=2").expect(200);
    expect(secondPage.body.data.map((book: { title: string }) => book.title)).toEqual(["Charlie"]);
  });

  it("keeps books without a rating at the end when sorting by rating", async () => {
    await createBook({ title: "Unrated" });
    await createBook({ title: "Three", rating: 3 });
    await createBook({ title: "Five", rating: 5 });

    const response = await request(app).get("/api/books?sort=rating&order=desc").expect(200);
    expect(response.body.data.map((book: { title: string }) => book.title)).toEqual(["Five", "Three", "Unrated"]);
  });

  it("returns 400 for invalid or unknown query parameters", async () => {
    const tooLarge = await request(app).get("/api/books?pageSize=500").expect(400);
    expect(tooLarge.body.error.details[0].path).toBe("query.pageSize");

    await request(app).get("/api/books?page=0").expect(400);
    await request(app).get("/api/books?sort=isbn").expect(400);
    await request(app).get("/api/books?foo=bar").expect(400);
  });
});

describe("GET /api/books/:id", () => {
  it("returns a single book", async () => {
    const created = await createBook();
    const response = await request(app).get(`/api/books/${created.id}`).expect(200);
    expect(response.body.data).toMatchObject({ id: created.id, title: "Clean Code" });
  });

  it("includes a summary of the assigned shelf slot", async () => {
    const created = await createBook();
    const slot = await prisma.shelfSlot.create({
      data: { slotNumber: 2, fsrChannel: 1, ledStartIdx: 8, ledEndIdx: 15 },
    });
    await prisma.book.update({ where: { id: created.id }, data: { slotId: slot.id, locationStatus: "ON_SHELF" } });

    const response = await request(app).get(`/api/books/${created.id}`).expect(200);
    expect(response.body.data.slot).toEqual({ id: slot.id, shelfNumber: 1, slotNumber: 2 });
    expect(response.body.data.locationStatus).toBe("ON_SHELF");
  });

  it("returns 404 for an unknown id and 400 for a malformed id", async () => {
    const notFound = await request(app).get(`/api/books/${randomUUID()}`).expect(404);
    expect(notFound.body.error.code).toBe("NOT_FOUND");

    const malformed = await request(app).get("/api/books/not-a-uuid").expect(400);
    expect(malformed.body.error.details[0].path).toBe("params.id");
  });
});

describe("PATCH /api/books/:id", () => {
  it("updates only the provided fields and clears fields set to null", async () => {
    const created = await createBook({ publisher: "Prentice Hall", rating: 4 });
    const response = await request(app)
      .patch(`/api/books/${created.id}`)
      .send({ title: "Clean Code (2nd ed.)", rating: null })
      .expect(200);

    expect(response.body.data).toMatchObject({
      title: "Clean Code (2nd ed.)",
      author: "Robert C. Martin",
      publisher: "Prentice Hall",
      rating: null,
    });
  });

  it("validates the merged state against stored values", async () => {
    const created = await createBook({ pageCount: 300, pagesRead: 200 });
    const response = await request(app).patch(`/api/books/${created.id}`).send({ pageCount: 150 }).expect(400);
    expect(response.body.error.details[0].path).toBe("body.pagesRead");
  });

  it("returns 400 for an empty body or a null required field", async () => {
    const created = await createBook();
    await request(app).patch(`/api/books/${created.id}`).send({}).expect(400);
    await request(app).patch(`/api/books/${created.id}`).send({ title: null }).expect(400);
  });

  it("returns 404 for an unknown id", async () => {
    await request(app).patch(`/api/books/${randomUUID()}`).send({ title: "X" }).expect(404);
  });

  it("returns 409 when changing the ISBN to one used by another book", async () => {
    await createBook({ isbn: "9780132350884" });
    const other = await createBook({ title: "Dune", author: "Frank Herbert" });
    const response = await request(app).patch(`/api/books/${other.id}`).send({ isbn: "9780132350884" }).expect(409);
    expect(response.body.error.code).toBe("ISBN_CONFLICT");
  });
});

describe("DELETE /api/books/:id", () => {
  it("deletes a book and returns 204, then 404 on repeated delete", async () => {
    const created = await createBook();
    await request(app).delete(`/api/books/${created.id}`).expect(204);
    await request(app).get(`/api/books/${created.id}`).expect(404);
    await request(app).delete(`/api/books/${created.id}`).expect(404);
  });

  it("keeps shelf events of a deleted book", async () => {
    const created = await createBook();
    await prisma.shelfEvent.create({ data: { type: "RFID_SCANNED", bookId: created.id, rfidUid: "04A1B2C3" } });

    await request(app).delete(`/api/books/${created.id}`).expect(204);
    const events = await prisma.shelfEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]?.bookId).toBeNull();
  });
});

describe("unknown routes", () => {
  it("returns 404 in the common error format", async () => {
    const response = await request(app).get("/api/does-not-exist").expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
