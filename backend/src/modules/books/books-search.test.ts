/**
 * @packageDocumentation
 * Integration tests for searching, filtering and sorting `GET /api/books`
 * (pg_trgm search on the test database), plus unit tests of the search helpers.
 */
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma, resetDatabase } from "../../test/db.js";
import { escapeLikePattern, isbnSearchFragment, splitSearchTerms } from "./book-search.js";

const app = createApp();

/** Titles of the books in a list response, in order. */
function titles(response: request.Response): string[] {
  return response.body.data.map((book: { title: string }) => book.title);
}

/**
 * Lists books with the given query string and expects HTTP 200.
 *
 * @param query - Query string without the leading `?`.
 * @returns The response.
 */
function list(query: string): Promise<request.Response> {
  return request(app).get(`/api/books?${query}`).expect(200);
}

beforeEach(async () => {
  await resetDatabase();
  const slot = await prisma.shelfSlot.create({
    data: { slotNumber: 1, ledStartIdx: 1, ledEndIdx: 1, fsrChannel: 0 },
  });
  await prisma.book.createMany({
    data: [
      {
        title: "Wiedźmin: Ostatnie życzenie",
        author: "Andrzej Sapkowski",
        publisher: "SuperNowa",
        isbn: "9788375780635",
        tags: ["fantasy", "polish"],
        status: "READ",
        rating: 5,
      },
      {
        title: "Solaris",
        author: "Stanisław Lem",
        publisher: "Wydawnictwo Literackie",
        tags: ["science fiction", "polish"],
        status: "READING",
        rating: 4,
      },
      {
        title: "Clean Code",
        author: "Robert C. Martin",
        publisher: "Prentice Hall",
        isbn: "9780132350884",
        tags: ["programming"],
        status: "READ",
        rating: 3,
        locationStatus: "ON_SHELF",
        slotId: slot.id,
      },
      {
        title: "Elements of Programming Style",
        author: "Brian Kernighan",
        tags: ["programming"],
        status: "WANT_TO_READ",
      },
      {
        title: "100% Pure Fun_Facts",
        author: "Anonymous",
        status: "WANT_TO_READ",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/books?q= (text search)", () => {
  it("matches case-insensitive substrings of the title, author and publisher", async () => {
    expect(titles(await list("q=SOLAR"))).toEqual(["Solaris"]);
    expect(titles(await list("q=sapkowski"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
    expect(titles(await list("q=prentice"))).toEqual(["Clean Code"]);
  });

  it("tolerates typos and missing Polish diacritics", async () => {
    expect(titles(await list("q=wiedzmin"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
    expect(titles(await list("q=sapkowsky"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
    expect(titles(await list("q=clen%20cod"))).toEqual(["Clean Code"]);
    expect(titles(await list("q=zyczenie%20stanislaw"))).toEqual([]);
    expect(titles(await list("q=zyczenie"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
    expect(titles(await list("q=stanislaw%20lem"))).toEqual(["Solaris"]);
  });

  it("requires every term to match (terms may match different fields)", async () => {
    expect(titles(await list("q=solaris%20lem"))).toEqual(["Solaris"]);
    expect((await list("q=solaris%20sapkowski")).body.meta.total).toBe(0);
  });

  it("matches a full ISBN (with hyphens, or as ISBN-10) and a partial ISBN", async () => {
    expect(titles(await list("q=978-0-13-235088-4"))).toEqual(["Clean Code"]);
    expect(titles(await list("q=0132350882"))).toEqual(["Clean Code"]);
    expect(titles(await list("q=8375780"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
  });

  it("matches tags exactly", async () => {
    expect(titles(await list("q=Fantasy"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
  });

  it("ranks by relevance by default: title matches first, then alphabetically", async () => {
    // "Elements of Programming Style" matches in the title; "Clean Code" only by tag.
    const response = await list("q=programming");
    expect(titles(response)).toEqual(["Elements of Programming Style", "Clean Code"]);
    expect(response.body.meta).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it("paginates relevance-sorted results", async () => {
    const second = await list("q=programming&pageSize=1&page=2");
    expect(titles(second)).toEqual(["Clean Code"]);
    expect(second.body.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });

  it("can sort search results by another field", async () => {
    expect(titles(await list("q=programming&sort=title"))).toEqual(["Clean Code", "Elements of Programming Style"]);
  });

  it("treats LIKE wildcards in the phrase literally", async () => {
    expect(titles(await list("q=100%25"))).toEqual(["100% Pure Fun_Facts"]);
    expect(titles(await list("q=fun_facts"))).toEqual(["100% Pure Fun_Facts"]);
    expect((await list("q=%25%25%25")).body.meta.total).toBe(0);
  });

  it("ignores an empty phrase", async () => {
    expect((await list("q=%20%20")).body.meta.total).toBe(5);
  });
});

describe("GET /api/books filters", () => {
  it("filters by one or several reading statuses (comma-separated or repeated)", async () => {
    expect(titles(await list("status=READING"))).toEqual(["Solaris"]);
    const expected = ["Clean Code", "Solaris", "Wiedźmin: Ostatnie życzenie"];
    expect(titles(await list("status=READ,READING&sort=title"))).toEqual(expected);
    expect(titles(await list("status=READ&status=READING&sort=title"))).toEqual(expected);
  });

  it("filters by shelf location", async () => {
    expect(titles(await list("location=ON_SHELF"))).toEqual(["Clean Code"]);
    expect((await list("location=UNASSIGNED,OFF_SHELF")).body.meta.total).toBe(4);
  });

  it("filters by minimum rating and excludes unrated books", async () => {
    expect(titles(await list("minRating=4&sort=rating"))).toEqual(["Wiedźmin: Ostatnie życzenie", "Solaris"]);
  });

  it("filters by tags (all given tags required, case-insensitive)", async () => {
    expect(titles(await list("tag=POLISH&sort=title"))).toEqual(["Solaris", "Wiedźmin: Ostatnie życzenie"]);
    expect(titles(await list("tag=polish,fantasy"))).toEqual(["Wiedźmin: Ostatnie życzenie"]);
  });

  it("combines search, filters and pagination metadata", async () => {
    const response = await list("q=polish&status=READ&minRating=5");
    expect(titles(response)).toEqual(["Wiedźmin: Ostatnie życzenie"]);
    expect(response.body.meta.total).toBe(1);
  });

  it("uses A→Z as the default order for title and author, newest first otherwise", async () => {
    expect(titles(await list("sort=author"))[0]).toBe("Wiedźmin: Ostatnie życzenie"); // Andrzej < Anonymous
    expect(titles(await list("sort=title&order=desc"))[0]).toBe("Wiedźmin: Ostatnie życzenie");
  });

  it("returns 400 for invalid filter values", async () => {
    const badStatus = await request(app).get("/api/books?status=READ,LOST").expect(400);
    expect(badStatus.body.error.details[0].path).toMatch(/^query\.status/);

    await request(app).get("/api/books?location=SHELF").expect(400);
    await request(app).get("/api/books?minRating=0").expect(400);
    await request(app).get("/api/books?minRating=6").expect(400);
    await request(app).get("/api/books?minRating=abc").expect(400);
    await request(app).get(`/api/books?q=${"a".repeat(201)}`).expect(400);
    await request(app).get(`/api/books?q=${Array.from({ length: 11 }, () => "a").join("%20")}`).expect(400);
    await request(app).get("/api/books?q=a&q=b").expect(400);
  });

  it("returns 400 for sort=relevance without a search phrase", async () => {
    const response = await request(app).get("/api/books?sort=relevance").expect(400);
    expect(response.body.error.details).toEqual([
      { path: "query.sort", message: "sort=relevance requires a search phrase (q)" },
    ]);
  });
});

describe("search helpers", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLikePattern("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });

  it("splits a phrase into unique lower-cased terms", () => {
    expect(splitSearchTerms("Lem  SOLARIS lem")).toEqual(["lem", "solaris"]);
  });

  it("detects ISBN fragments", () => {
    expect(isbnSearchFragment("0-13-235088-2")).toBe("9780132350884");
    expect(isbnSearchFragment("978-83")).toBe("97883");
    expect(isbnSearchFragment("12")).toBeNull();
    expect(isbnSearchFragment("lem")).toBeNull();
  });
});
