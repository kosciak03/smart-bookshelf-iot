/**
 * @packageDocumentation
 * Integration tests for `GET /api/stats`.
 */
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma, resetDatabase } from "../../test/db.js";
import { currentYear } from "./stats.service.js";

const app = createApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/stats", () => {
  it("returns zeroed statistics for an empty library", async () => {
    const response = await request(app).get("/api/stats?year=2026").expect(200);
    const stats = response.body.data;
    expect(stats.totals).toEqual({
      books: 0,
      wantToRead: 0,
      reading: 0,
      read: 0,
      onShelf: 0,
      offShelf: 0,
      unassigned: 0,
      pagesRead: 0,
    });
    expect(stats.ratings).toEqual({
      average: null,
      rated: 0,
      distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
    });
    expect(stats.year.monthly).toHaveLength(12);
    expect(stats.year).toMatchObject({ year: 2026, booksFinished: 0, pagesFinished: 0, availableYears: [2026] });
    expect(stats.currentlyReading).toEqual([]);
    expect(stats.topTags).toEqual([]);
  });

  it("aggregates counts, ratings, monthly reading and tags", async () => {
    await prisma.book.createMany({
      data: [
        {
          title: "A",
          author: "X",
          status: "READ",
          pageCount: 300,
          pagesRead: 300,
          rating: 5,
          tags: ["fantasy", "polish"],
          finishedAt: new Date("2026-03-10T12:00:00Z"),
          locationStatus: "ON_SHELF",
        },
        {
          title: "B",
          author: "X",
          status: "READ",
          pageCount: 200,
          pagesRead: 200,
          rating: 4,
          tags: ["fantasy"],
          finishedAt: new Date("2026-03-20T12:00:00Z"),
        },
        // No page count: counts as a book but adds no pages.
        { title: "C", author: "X", status: "READ", rating: 4, finishedAt: new Date("2026-07-01T12:00:00Z") },
        // Finished in another year.
        { title: "D", author: "X", status: "READ", pageCount: 100, pagesRead: 100, finishedAt: new Date("2025-05-05T12:00:00Z") },
        // Read without a known date: not part of any month.
        { title: "E", author: "X", status: "READ", pageCount: 50, pagesRead: 50 },
        { title: "F", author: "X", status: "READING", pageCount: 400, pagesRead: 120, tags: ["polish"] },
        { title: "G", author: "X", status: "WANT_TO_READ", locationStatus: "OFF_SHELF" },
      ],
    });

    const stats = (await request(app).get("/api/stats?year=2026").expect(200)).body.data;

    expect(stats.totals).toEqual({
      books: 7,
      wantToRead: 1,
      reading: 1,
      read: 5,
      onShelf: 1,
      offShelf: 1,
      unassigned: 5,
      pagesRead: 300 + 200 + 100 + 50 + 120,
    });
    expect(stats.ratings.average).toBe(4.33);
    expect(stats.ratings.rated).toBe(3);
    expect(stats.ratings.distribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 1 },
    ]);
    expect(stats.year.booksFinished).toBe(3);
    expect(stats.year.pagesFinished).toBe(500);
    expect(stats.year.monthly[2]).toEqual({ month: 3, books: 2, pages: 500 });
    expect(stats.year.monthly[6]).toEqual({ month: 7, books: 1, pages: 0 });
    expect(stats.year.availableYears).toEqual([2026, 2025]);
    expect(stats.currentlyReading).toEqual([
      expect.objectContaining({ title: "F", pagesRead: 120, pageCount: 400 }),
    ]);
    expect(stats.topTags).toEqual([
      { tag: "fantasy", count: 2 },
      { tag: "polish", count: 2 },
    ]);

    const previous = (await request(app).get("/api/stats?year=2025").expect(200)).body.data;
    expect(previous.year).toMatchObject({ booksFinished: 1, pagesFinished: 100 });
  });

  it("groups by month in the owner's time zone (Europe/Warsaw)", async () => {
    // 23:30 UTC on 31 Dec 2025 is 00:30 on 1 Jan 2026 in Warsaw.
    await prisma.book.create({
      data: { title: "New Year", author: "X", status: "READ", finishedAt: new Date("2025-12-31T23:30:00Z") },
    });
    const stats = (await request(app).get("/api/stats?year=2026").expect(200)).body.data;
    expect(stats.year.monthly[0]).toMatchObject({ month: 1, books: 1 });
    expect(stats.year.availableYears).toEqual([2026]);
  });

  it("defaults to the current year and validates the query", async () => {
    const stats = (await request(app).get("/api/stats").expect(200)).body.data;
    expect(stats.year.year).toBe(currentYear());

    await request(app).get("/api/stats?year=abc").expect(400);
    await request(app).get("/api/stats?year=1800").expect(400);
    await request(app).get("/api/stats?foo=1").expect(400);
  });
});
