/**
 * @packageDocumentation
 * Recorded-style responses of external ISBN APIs and a `fetch` mock router
 * used by unit and integration tests (no real network access).
 */
import { vi } from "vitest";

/** ISBN-13 of "Clean Code" used throughout the tests. */
export const CLEAN_CODE_ISBN = "9780132350884";

/** Google Books `volumes?q=isbn:` response for {@link CLEAN_CODE_ISBN}. */
export const googleBooksCleanCode = {
  kind: "books#volumes",
  totalItems: 1,
  items: [
    {
      kind: "books#volume",
      id: "hjEFCAAAQBAJ",
      volumeInfo: {
        title: "Clean Code",
        subtitle: "A Handbook of Agile Software Craftsmanship",
        authors: ["Robert C. Martin"],
        publisher: "Pearson Education",
        publishedDate: "2008-08-01",
        description: "Even bad code can function. <b>But</b> if code isn't clean,<br>it can bring a development organization to its knees.",
        industryIdentifiers: [
          { type: "ISBN_13", identifier: "9780132350884" },
          { type: "ISBN_10", identifier: "0132350882" },
        ],
        pageCount: 464,
        categories: ["Computers"],
        imageLinks: {
          smallThumbnail: "http://books.google.com/books/content?id=hjEFCAAAQBAJ&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api",
          thumbnail: "http://books.google.com/books/content?id=hjEFCAAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
        },
        language: "en",
      },
    },
  ],
};

/** Google Books response when nothing matches. */
export const googleBooksEmpty = { kind: "books#volumes", totalItems: 0 };

/** Google Books error body when the anonymous daily quota is exhausted. */
export const googleBooksQuotaExceeded = {
  error: { code: 429, message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'." },
};

/** Open Library `api/books?jscmd=data` response for {@link CLEAN_CODE_ISBN}. */
export const openLibraryCleanCode = {
  [`ISBN:${CLEAN_CODE_ISBN}`]: {
    url: "https://openlibrary.org/books/OL22146213M/Clean_Code",
    key: "/books/OL22146213M",
    title: "Clean Code",
    subtitle: "A Handbook of Agile Software Craftsmanship",
    authors: [{ url: "http://openlibrary.org/authors/OL2653686A/Robert_C._Martin", name: "Robert C. Martin" }],
    number_of_pages: 431,
    publishers: [{ name: "Prentice Hall" }],
    publish_date: "July 2008",
    subjects: [
      { name: "Agile software development", url: "https://openlibrary.org/subjects/agile_software_development" },
      { name: "Reliability", url: "https://openlibrary.org/subjects/reliability" },
      { name: "Computer software", url: "https://openlibrary.org/subjects/computer_software" },
    ],
    cover: {
      small: "https://covers.openlibrary.org/b/id/15126503-S.jpg",
      medium: "https://covers.openlibrary.org/b/id/15126503-M.jpg",
      large: "https://covers.openlibrary.org/b/id/15126503-L.jpg",
    },
  },
};

/** Open Library response when the ISBN is unknown. */
export const openLibraryEmpty = {};

/** Simulated upstream behaviour: a JSON body with a status, or a network failure. */
export type UpstreamReply = { status?: number; body: unknown } | "network-error";

/** Replies of both upstream APIs for one test. */
export interface UpstreamScenario {
  google: UpstreamReply;
  openLibrary: UpstreamReply;
}

/**
 * Replaces the global `fetch` with a mock that routes requests to Google Books
 * or Open Library replies. Restore with `vi.unstubAllGlobals()`.
 *
 * @param scenario - Replies of both APIs.
 * @returns The mock, for asserting calls.
 */
export function mockUpstreams(scenario: UpstreamScenario) {
  const reply = (upstream: UpstreamReply): Response => {
    if (upstream === "network-error") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(upstream.body), {
      status: upstream.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://www.googleapis.com/books/")) return reply(scenario.google);
    if (url.startsWith("https://openlibrary.org/api/books")) return reply(scenario.openLibrary);
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Returns the URLs requested through a fetch mock.
 *
 * @param fetchMock - Mock returned by {@link mockUpstreams}.
 * @returns Requested URLs in call order.
 */
export function requestedUrls(fetchMock: ReturnType<typeof mockUpstreams>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}
