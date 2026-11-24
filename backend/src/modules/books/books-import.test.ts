/**
 * @packageDocumentation
 * Integration tests of `POST /api/books/import` (mocked external APIs, test database).
 */
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { prisma, resetDatabase } from "../../test/db.js";
import {
  CLEAN_CODE_ISBN,
  googleBooksCleanCode,
  googleBooksEmpty,
  mockUpstreams,
  openLibraryCleanCode,
  openLibraryEmpty,
} from "../../test/isbn-fixtures.js";
import { isbnLookupService } from "../isbn/isbn.service.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
  isbnLookupService.clearCache();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Creates a free shelf slot directly in the database.
 *
 * @param slotNumber - Slot position (also used as the FSR channel offset).
 * @returns The created slot.
 */
function createSlot(slotNumber = 1) {
  return prisma.shelfSlot.create({
    data: { slotNumber, fsrChannel: slotNumber - 1, ledStartIdx: (slotNumber - 1) * 8, ledEndIdx: slotNumber * 8 - 1 },
  });
}

describe("POST /api/books/import", () => {
  it("creates a book from fetched metadata", async () => {
    mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).post("/api/books/import").send({ isbn: "978-0-13-235088-4" }).expect(201);

    expect(response.headers.location).toBe(`/api/books/${response.body.data.id}`);
    expect(response.body.meta).toEqual({ source: "google-books", cached: false });
    expect(response.body.data).toMatchObject({
      isbn: CLEAN_CODE_ISBN,
      title: "Clean Code: A Handbook of Agile Software Craftsmanship",
      author: "Robert C. Martin",
      publisher: "Pearson Education",
      publishedYear: 2008,
      pageCount: 464,
      tags: ["computers"],
      status: "WANT_TO_READ",
      locationStatus: "UNASSIGNED",
      slot: null,
    });
    await expect(prisma.book.count()).resolves.toBe(1);
  });

  it("applies overrides on top of fetched data", async () => {
    mockUpstreams({ google: { body: googleBooksEmpty }, openLibrary: { body: openLibraryCleanCode } });

    const response = await request(app)
      .post("/api/books/import")
      .send({ isbn: CLEAN_CODE_ISBN, title: "Clean Code", status: "READING", pagesRead: 50, startedAt: "2026-11-20", tags: ["Craft"] })
      .expect(201);

    expect(response.body.meta.source).toBe("open-library");
    expect(response.body.data).toMatchObject({
      title: "Clean Code",
      publisher: "Prentice Hall",
      status: "READING",
      pagesRead: 50,
      startedAt: "2026-11-20T00:00:00.000Z",
      tags: ["craft"],
    });
  });

  it("assigns a free shelf slot (OFF_SHELF until the FSR confirms it)", async () => {
    mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });
    const slot = await createSlot(3);

    const response = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, slotId: slot.id }).expect(201);
    expect(response.body.data.slot).toEqual({ id: slot.id, shelfNumber: 1, slotNumber: 3 });
    expect(response.body.data.locationStatus).toBe("OFF_SHELF");
  });

  it("returns 409 for an existing ISBN without calling external APIs", async () => {
    const fetchMock = mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });
    await prisma.book.create({ data: { title: "Clean Code", author: "Robert C. Martin", isbn: CLEAN_CODE_ISBN } });

    const response = await request(app).post("/api/books/import").send({ isbn: "0-13-235088-2" }).expect(409);
    expect(response.body.error.code).toBe("ISBN_CONFLICT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the slot is already taken and 400 when it does not exist", async () => {
    mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });
    const slot = await createSlot(1);
    await prisma.book.create({ data: { title: "Dune", author: "Frank Herbert", slotId: slot.id, locationStatus: "ON_SHELF" } });

    const taken = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, slotId: slot.id }).expect(409);
    expect(taken.body.error.code).toBe("SLOT_CONFLICT");

    const missing = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, slotId: randomUUID() }).expect(400);
    expect(missing.body.error.details[0].path).toBe("body.slotId");
  });

  it("returns 404 when no source knows the ISBN", async () => {
    mockUpstreams({ google: { body: googleBooksEmpty }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN }).expect(404);
    expect(response.body.error.code).toBe("ISBN_NOT_FOUND");
    await expect(prisma.book.count()).resolves.toBe(0);
  });

  it("returns 502 when every source is unavailable", async () => {
    mockUpstreams({ google: { status: 500, body: {} }, openLibrary: "network-error" });
    await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN }).expect(502);
  });

  it("returns 400 for a missing/invalid ISBN, unknown fields and invalid overrides", async () => {
    const fetchMock = mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });

    await request(app).post("/api/books/import").send({}).expect(400);
    await request(app).post("/api/books/import").send({ isbn: "123" }).expect(400);
    await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, rfidUid: "04A1B2C3" }).expect(400);
    await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, rating: 9 }).expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates overrides against fetched data (pagesRead > fetched pageCount)", async () => {
    mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, pagesRead: 999 }).expect(400);
    expect(response.body.error.details[0].path).toBe("body.pagesRead");
  });

  it("asks for an author when the source has none", async () => {
    const withoutAuthor = structuredClone(googleBooksCleanCode);
    delete (withoutAuthor.items[0]!.volumeInfo as { authors?: string[] }).authors;
    mockUpstreams({ google: { body: withoutAuthor }, openLibrary: { body: openLibraryEmpty } });

    const missing = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN }).expect(400);
    expect(missing.body.error.details[0].path).toBe("body.author");

    const provided = await request(app).post("/api/books/import").send({ isbn: CLEAN_CODE_ISBN, author: "R. C. Martin" }).expect(201);
    expect(provided.body.data.author).toBe("R. C. Martin");
  });
});
