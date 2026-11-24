/**
 * @packageDocumentation
 * Integration tests of `GET /api/isbn/:isbn` (mocked external APIs).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import {
  CLEAN_CODE_ISBN,
  googleBooksCleanCode,
  googleBooksEmpty,
  googleBooksQuotaExceeded,
  mockUpstreams,
  openLibraryCleanCode,
  openLibraryEmpty,
  requestedUrls,
} from "../../test/isbn-fixtures.js";
import { isbnLookupService } from "./isbn.service.js";

const app = createApp();

beforeEach(() => {
  isbnLookupService.clearCache();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/isbn/:isbn", () => {
  it("returns normalized metadata from Google Books", async () => {
    mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).get(`/api/isbn/${CLEAN_CODE_ISBN}`).expect(200);
    expect(response.body.meta).toEqual({ cached: false });
    expect(response.body.data).toMatchObject({
      isbn: CLEAN_CODE_ISBN,
      title: "Clean Code: A Handbook of Agile Software Craftsmanship",
      author: "Robert C. Martin",
      publishedYear: 2008,
      pageCount: 464,
      source: "google-books",
    });
  });

  it("normalizes hyphenated ISBN-10 input to ISBN-13 before querying", async () => {
    const fetchMock = mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).get("/api/isbn/0-13-235088-2").expect(200);
    expect(response.body.data.isbn).toBe(CLEAN_CODE_ISBN);
    expect(requestedUrls(fetchMock)[0]).toContain(`isbn%3A${CLEAN_CODE_ISBN}`);
  });

  it("falls back to Open Library when Google Books is over quota", async () => {
    mockUpstreams({ google: { status: 429, body: googleBooksQuotaExceeded }, openLibrary: { body: openLibraryCleanCode } });

    const response = await request(app).get(`/api/isbn/${CLEAN_CODE_ISBN}`).expect(200);
    expect(response.body.data).toMatchObject({ source: "open-library", publisher: "Prentice Hall", pageCount: 431 });
  });

  it("serves the second request from the cache", async () => {
    const fetchMock = mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: openLibraryEmpty } });

    await request(app).get(`/api/isbn/${CLEAN_CODE_ISBN}`).expect(200);
    const second = await request(app).get("/api/isbn/978-0-13-235088-4").expect(200);
    expect(second.body.meta).toEqual({ cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for an invalid ISBN without calling external APIs", async () => {
    const fetchMock = mockUpstreams({ google: { body: googleBooksEmpty }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).get("/api/isbn/9780132350885").expect(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: [{ path: "params.isbn" }] });
    await request(app).get("/api/isbn/abc").expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 when no source knows the ISBN", async () => {
    mockUpstreams({ google: { body: googleBooksEmpty }, openLibrary: { body: openLibraryEmpty } });

    const response = await request(app).get(`/api/isbn/${CLEAN_CODE_ISBN}`).expect(404);
    expect(response.body.error.code).toBe("ISBN_NOT_FOUND");
  });

  it("returns 502 when every source is unavailable", async () => {
    mockUpstreams({ google: "network-error", openLibrary: { status: 503, body: {} } });

    const response = await request(app).get(`/api/isbn/${CLEAN_CODE_ISBN}`).expect(502);
    expect(response.body.error).toEqual({
      code: "METADATA_SOURCE_UNAVAILABLE",
      message: `Book metadata sources are unavailable for ISBN ${CLEAN_CODE_ISBN}`,
      details: [
        { path: "google-books", message: "network error" },
        { path: "open-library", message: "HTTP 503" },
      ],
    });
  });
});
