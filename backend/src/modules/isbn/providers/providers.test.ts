/**
 * @packageDocumentation
 * Unit tests of the Google Books and Open Library providers (mocked `fetch`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLEAN_CODE_ISBN,
  googleBooksCleanCode,
  googleBooksEmpty,
  googleBooksQuotaExceeded,
  mockUpstreams,
  openLibraryCleanCode,
  openLibraryEmpty,
  requestedUrls,
} from "../../../test/isbn-fixtures.js";
import { ProviderError } from "../metadata.types.js";
import { GoogleBooksProvider } from "./google-books.js";
import { OpenLibraryProvider } from "./open-library.js";

const google = new GoogleBooksProvider({ timeoutMs: 1000 });
const openLibrary = new OpenLibraryProvider({ timeoutMs: 1000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GoogleBooksProvider", () => {
  it("maps a volume to normalized metadata", async () => {
    mockUpstreams({ google: { body: googleBooksCleanCode }, openLibrary: { body: {} } });

    await expect(google.lookup(CLEAN_CODE_ISBN)).resolves.toEqual({
      isbn: CLEAN_CODE_ISBN,
      title: "Clean Code: A Handbook of Agile Software Craftsmanship",
      author: "Robert C. Martin",
      authors: ["Robert C. Martin"],
      description: "Even bad code can function. But if code isn't clean,\nit can bring a development organization to its knees.",
      coverUrl: "https://books.google.com/books/content?id=hjEFCAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
      publisher: "Pearson Education",
      publishedYear: 2008,
      pageCount: 464,
      tags: ["computers"],
      source: "google-books",
    });
  });

  it("queries by ISBN and sends the API key only when configured", async () => {
    const fetchMock = mockUpstreams({ google: { body: googleBooksEmpty }, openLibrary: { body: {} } });
    await google.lookup(CLEAN_CODE_ISBN);
    await new GoogleBooksProvider({ apiKey: "secret-key", timeoutMs: 1000 }).lookup(CLEAN_CODE_ISBN);

    const [withoutKey, withKey] = requestedUrls(fetchMock).map((url) => new URL(url));
    expect(withoutKey?.searchParams.get("q")).toBe(`isbn:${CLEAN_CODE_ISBN}`);
    expect(withoutKey?.searchParams.has("key")).toBe(false);
    expect(withKey?.searchParams.get("key")).toBe("secret-key");
  });

  it("returns null when there are no results", async () => {
    mockUpstreams({ google: { body: googleBooksEmpty }, openLibrary: { body: {} } });
    await expect(google.lookup(CLEAN_CODE_ISBN)).resolves.toBeNull();
  });

  it("ignores volumes listing a different ISBN", async () => {
    const otherBook = structuredClone(googleBooksCleanCode);
    otherBook.items[0]!.volumeInfo.industryIdentifiers = [{ type: "ISBN_13", identifier: "9780441172719" }];
    mockUpstreams({ google: { body: otherBook }, openLibrary: { body: {} } });

    await expect(google.lookup(CLEAN_CODE_ISBN)).resolves.toBeNull();
  });

  it("throws ProviderError on HTTP errors, network errors and invalid payloads", async () => {
    mockUpstreams({ google: { status: 429, body: googleBooksQuotaExceeded }, openLibrary: { body: {} } });
    await expect(google.lookup(CLEAN_CODE_ISBN)).rejects.toThrow(new ProviderError("google-books", "HTTP 429"));

    mockUpstreams({ google: "network-error", openLibrary: { body: {} } });
    await expect(google.lookup(CLEAN_CODE_ISBN)).rejects.toThrow("network error");

    mockUpstreams({ google: { body: { items: "not-an-array" } }, openLibrary: { body: {} } });
    await expect(google.lookup(CLEAN_CODE_ISBN)).rejects.toThrow("unexpected response format");
  });
});

describe("OpenLibraryProvider", () => {
  it("maps a record to normalized metadata", async () => {
    mockUpstreams({ google: { body: {} }, openLibrary: { body: openLibraryCleanCode } });

    await expect(openLibrary.lookup(CLEAN_CODE_ISBN)).resolves.toEqual({
      isbn: CLEAN_CODE_ISBN,
      title: "Clean Code: A Handbook of Agile Software Craftsmanship",
      author: "Robert C. Martin",
      authors: ["Robert C. Martin"],
      description: null,
      coverUrl: "https://covers.openlibrary.org/b/id/15126503-L.jpg",
      publisher: "Prentice Hall",
      publishedYear: 2008,
      pageCount: 431,
      tags: ["agile software development", "reliability", "computer software"],
      source: "open-library",
    });
  });

  it("requests the data view for the ISBN bibkey", async () => {
    const fetchMock = mockUpstreams({ google: { body: {} }, openLibrary: { body: openLibraryEmpty } });
    await openLibrary.lookup(CLEAN_CODE_ISBN);

    const url = new URL(requestedUrls(fetchMock)[0]!);
    expect(url.searchParams.get("bibkeys")).toBe(`ISBN:${CLEAN_CODE_ISBN}`);
    expect(url.searchParams.get("jscmd")).toBe("data");
  });

  it("returns null for an unknown ISBN", async () => {
    mockUpstreams({ google: { body: {} }, openLibrary: { body: openLibraryEmpty } });
    await expect(openLibrary.lookup(CLEAN_CODE_ISBN)).resolves.toBeNull();
  });

  it("throws ProviderError on HTTP errors", async () => {
    mockUpstreams({ google: { body: {} }, openLibrary: { status: 503, body: {} } });
    await expect(openLibrary.lookup(CLEAN_CODE_ISBN)).rejects.toThrow("HTTP 503");
  });
});
