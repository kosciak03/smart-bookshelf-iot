/**
 * @packageDocumentation
 * Integration tests of the reading rules through `/api/books` and of the
 * matching CHECK constraints in the database.
 */
import { Prisma } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma, resetDatabase } from "../../test/db.js";

const app = createApp();

/**
 * Creates a 300-page book through the API.
 *
 * @param body - Extra fields of the request body.
 * @returns The created book.
 */
async function createBook(body: Record<string, unknown> = {}): Promise<Record<string, unknown> & { id: string }> {
  const response = await request(app)
    .post("/api/books")
    .send({ title: "Dune", author: "Frank Herbert", pageCount: 300, ...body })
    .expect(201);
  return response.body.data;
}

/**
 * Sends `PATCH /api/books/:id`.
 *
 * @param id - Book id.
 * @param body - Patch body.
 * @returns The response (status not checked).
 */
function patch(id: string, body: Record<string, unknown>): request.Test {
  return request(app).patch(`/api/books/${id}`).send(body);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("reading progress through the API", () => {
  it("follows a full reading cycle: want to read → reading → read → re-read", async () => {
    const book = await createBook();
    expect(book).toMatchObject({ status: "WANT_TO_READ", pagesRead: 0, startedAt: null });

    const started = (await patch(book.id, { pagesRead: 50 }).expect(200)).body.data;
    expect(started).toMatchObject({ status: "READING", pagesRead: 50, finishedAt: null });
    expect(Date.now() - Date.parse(started.startedAt)).toBeLessThan(60_000);

    const finished = (await patch(book.id, { pagesRead: 300, rating: 5 }).expect(200)).body.data;
    expect(finished).toMatchObject({ status: "READ", pagesRead: 300, rating: 5, startedAt: started.startedAt });
    expect(finished.finishedAt).not.toBeNull();

    const reRead = (await patch(book.id, { status: "READING" }).expect(200)).body.data;
    expect(reRead).toMatchObject({ status: "READING", pagesRead: 0, rating: 5, finishedAt: null });
  });

  it("marks a book as read in one step and completes its progress", async () => {
    const book = await createBook({ status: "READING", pagesRead: 10 });
    const read = (await patch(book.id, { status: "READ", finishedAt: "2026-11-20" }).expect(200)).body.data;
    expect(read).toMatchObject({ status: "READ", pagesRead: 300, finishedAt: "2026-11-20T00:00:00.000Z" });
  });

  it("resets progress, dates and rating when moved back to the wish list", async () => {
    const book = await createBook({ status: "READING", pagesRead: 100, rating: 3, startedAt: "2026-11-01" });
    const reset = (await patch(book.id, { status: "WANT_TO_READ" }).expect(200)).body.data;
    expect(reset).toMatchObject({ status: "WANT_TO_READ", pagesRead: 0, rating: null, startedAt: null });
  });

  it("derives the status when a book is created, without inventing dates", async () => {
    expect(await createBook({ pagesRead: 30 })).toMatchObject({ status: "READING", startedAt: null });
    expect(await createBook({ status: "READ" })).toMatchObject({ pagesRead: 300, finishedAt: null });
  });

  it("rejects a rating for a book on the wish list", async () => {
    const response = await request(app)
      .post("/api/books")
      .send({ title: "Dune", author: "Frank Herbert", rating: 4 })
      .expect(400);
    expect(response.body.error.details).toEqual([
      { path: "body.rating", message: "Only books being read or already read can be rated" },
    ]);
  });

  it("returns 400 with field details for inconsistent updates", async () => {
    const book = await createBook();

    const rated = await patch(book.id, { rating: 5 }).expect(400);
    expect(rated.body.error.message).toBe("Update would leave the book in an inconsistent state");
    expect(rated.body.error.details[0].path).toBe("body.rating");

    const finishedTooEarly = await patch(book.id, { status: "READING", finishedAt: "2026-11-02" }).expect(400);
    expect(finishedTooEarly.body.error.details[0].path).toBe("body.finishedAt");

    const unread = await patch(book.id, { status: "READ", pagesRead: 100 }).expect(400);
    expect(unread.body.error.details[0].path).toBe("body.pagesRead");

    const future = await patch(book.id, { status: "READING", startedAt: "2099-01-01" }).expect(400);
    expect(future.body.error.details[0].message).toBe("startedAt cannot be in the future");
  });
});

describe("reading-state CHECK constraints", () => {
  /**
   * Runs a raw insert and returns the name of the violated constraint.
   *
   * @param values - SQL fragment with `status, pageCount, pagesRead, rating, finishedAt` values.
   * @returns The error message of the database.
   */
  async function insertError(values: Prisma.Sql): Promise<string> {
    const error = await prisma
      .$executeRaw`INSERT INTO "Book" ("id", "title", "author", "status", "pageCount", "pagesRead", "rating", "finishedAt", "updatedAt")
        VALUES (gen_random_uuid(), 'X', 'Y', ${values}, now())`
      .then(() => null)
      .catch((caught: unknown) => caught);
    return error instanceof Error ? error.message : "no error";
  }

  it("rejects inconsistent rows written outside the API", async () => {
    expect(await insertError(Prisma.sql`'WANT_TO_READ', 300, 10, NULL, NULL`)).toContain(
      "Book_want_to_read_state_check",
    );
    expect(await insertError(Prisma.sql`'WANT_TO_READ', 300, 0, 4, NULL`)).toContain("Book_want_to_read_state_check");
    expect(await insertError(Prisma.sql`'READING', 300, 10, NULL, now()`)).toContain("Book_reading_state_check");
    expect(await insertError(Prisma.sql`'READ', 300, 10, NULL, NULL`)).toContain("Book_read_state_check");
  });
});
