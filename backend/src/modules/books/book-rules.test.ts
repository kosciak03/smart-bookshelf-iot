/**
 * @packageDocumentation
 * Unit tests of the reading rules (pure function, no database).
 */
import { describe, expect, it } from "vitest";
import { applyReadingRules, NEW_BOOK_READING_STATE, type ReadingPatch, type ReadingState } from "./book-rules.js";

const NOW = new Date("2026-11-25T12:00:00Z");
const EARLIER = new Date("2026-11-01T00:00:00Z");

/** Builds a stored reading state (defaults: a 300-page WANT_TO_READ book). */
function stored(overrides: Partial<ReadingState> = {}): ReadingState {
  return { ...NEW_BOOK_READING_STATE, pageCount: 300, ...overrides };
}

/** Applies the rules to an existing book and expects no issues. */
function update(previous: ReadingState, patch: ReadingPatch): ReadingState {
  const { state, issues } = applyReadingRules(previous, patch, NOW);
  expect(issues).toEqual([]);
  return state;
}

/** Returns the fields reported by the rules. */
function issueFields(previous: ReadingState | null, patch: ReadingPatch): string[] {
  return applyReadingRules(previous, patch, NOW).issues.map(([field]) => field);
}

describe("derived status", () => {
  it("starts reading when progress is recorded", () => {
    expect(update(stored(), { pagesRead: 10 })).toMatchObject({ status: "READING", startedAt: NOW, pagesRead: 10 });
  });

  it("finishes the book when the last page is reached", () => {
    const reading = stored({ status: "READING", pagesRead: 200, startedAt: EARLIER });
    expect(update(reading, { pagesRead: 300 })).toMatchObject({ status: "READ", startedAt: EARLIER, finishedAt: NOW });
  });

  it("goes straight to READ when a WANT_TO_READ book jumps to the last page (start date unknown)", () => {
    expect(update(stored(), { pagesRead: 300 })).toMatchObject({ status: "READ", startedAt: null, finishedAt: NOW });
  });

  it("does not derive READ when the page count is unknown", () => {
    expect(update(stored({ pageCount: null }), { pagesRead: 300 }).status).toBe("READING");
  });

  it("does not override an explicit status", () => {
    expect(issueFields(stored(), { status: "WANT_TO_READ", pagesRead: 10 })).toEqual(["pagesRead"]);
  });
});

describe("status transitions", () => {
  it("→ READING records startedAt but keeps a known one", () => {
    expect(update(stored(), { status: "READING" }).startedAt).toEqual(NOW);
    expect(update(stored(), { status: "READING", startedAt: EARLIER }).startedAt).toEqual(EARLIER);
  });

  it("→ READ records finishedAt and completes the progress", () => {
    const reading = stored({ status: "READING", pagesRead: 120, startedAt: EARLIER });
    expect(update(reading, { status: "READ" })).toMatchObject({ pagesRead: 300, startedAt: EARLIER, finishedAt: NOW });
  });

  it("→ READ keeps an explicit finishedAt", () => {
    const reading = stored({ status: "READING", startedAt: EARLIER });
    const finished = new Date("2026-11-20T00:00:00Z");
    expect(update(reading, { status: "READ", finishedAt: finished }).finishedAt).toEqual(finished);
  });

  it("READ → READING is a re-read: progress restarts, rating is kept", () => {
    const read = stored({ status: "READ", pagesRead: 300, rating: 4, startedAt: EARLIER, finishedAt: EARLIER });
    expect(update(read, { status: "READING" })).toEqual({
      status: "READING",
      pageCount: 300,
      pagesRead: 0,
      rating: 4,
      startedAt: NOW,
      finishedAt: null,
    });
  });

  it("→ WANT_TO_READ clears progress, dates and rating", () => {
    const reading = stored({ status: "READING", pagesRead: 50, rating: 3, startedAt: EARLIER });
    expect(update(reading, { status: "WANT_TO_READ" })).toEqual(stored());
  });

  it("keeps pagesRead equal to pageCount when the page count of a READ book changes", () => {
    const read = stored({ status: "READ", pagesRead: 300, finishedAt: EARLIER });
    expect(update(read, { pageCount: 320 })).toMatchObject({ pagesRead: 320, finishedAt: EARLIER });
  });

  it("does not touch the dates when the status does not change", () => {
    const reading = stored({ status: "READING", pagesRead: 50, startedAt: EARLIER });
    expect(update(reading, { pagesRead: 60 })).toMatchObject({ status: "READING", startedAt: EARLIER });
  });
});

describe("new books", () => {
  it("derives the status but never invents reading dates", () => {
    expect(applyReadingRules(null, { pageCount: 300, pagesRead: 40 }, NOW).state).toMatchObject({
      status: "READING",
      startedAt: null,
    });
    expect(applyReadingRules(null, { status: "READ", pageCount: 300 }, NOW).state).toMatchObject({
      pagesRead: 300,
      startedAt: null,
      finishedAt: null,
    });
  });

  it("accepts explicit historical dates", () => {
    const { issues } = applyReadingRules(
      null,
      { status: "READ", startedAt: new Date("2020-01-01"), finishedAt: new Date("2020-02-01") },
      NOW,
    );
    expect(issues).toEqual([]);
  });
});

describe("invariants", () => {
  it("allows rating only for books being read or already read", () => {
    expect(issueFields(null, { rating: 5 })).toEqual(["rating"]);
    expect(issueFields(null, { status: "READING", rating: 5 })).toEqual([]);
    expect(issueFields(null, { status: "READ", rating: 5 })).toEqual([]);
  });

  it("rejects dates that do not match the status", () => {
    expect(issueFields(null, { startedAt: EARLIER })).toEqual(["startedAt"]);
    expect(issueFields(null, { status: "READING", finishedAt: EARLIER })).toEqual(["finishedAt"]);
  });

  it("rejects a READ book with unread pages", () => {
    expect(issueFields(null, { status: "READ", pageCount: 300, pagesRead: 100 })).toEqual(["pagesRead"]);
  });

  it("rejects progress beyond the page count and finishedAt before startedAt", () => {
    expect(issueFields(stored({ status: "READING" }), { pagesRead: 301 })).toEqual(["pagesRead"]);
    expect(
      issueFields(null, { status: "READ", startedAt: new Date("2026-02-01"), finishedAt: new Date("2026-01-01") }),
    ).toEqual(["finishedAt"]);
  });

  it("rejects reading dates in the future, with one day of tolerance", () => {
    expect(issueFields(null, { status: "READING", startedAt: new Date("2026-11-26T00:00:00Z") })).toEqual([]);
    expect(issueFields(null, { status: "READING", startedAt: new Date("2026-11-27T00:00:00Z") })).toEqual([
      "startedAt",
    ]);
  });
});
