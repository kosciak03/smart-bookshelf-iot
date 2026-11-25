/**
 * @packageDocumentation
 * Business rules for reading progress, reading status, reading dates and rating.
 *
 * The rules are a pure function of the stored state, the requested change and
 * the current time, so they can be unit-tested without a database.
 *
 * **Derived status** (only when `status` is not given explicitly):
 * - `pagesRead > 0` on a `WANT_TO_READ` book → `READING`;
 * - `pagesRead` set to `pageCount` on a book being read → `READ`.
 *
 * **Status transitions of an existing book** (fields given explicitly win):
 * - → `READING`: `startedAt` = now when unknown, `finishedAt` cleared;
 *   from `READ` this is a re-read: progress restarts (`pagesRead` = 0,
 *   `startedAt` = now) and the rating is kept;
 * - → `READ`: `finishedAt` = now when unknown;
 * - → `WANT_TO_READ`: progress, reading dates and rating are cleared.
 *
 * When a book is created no dates are filled in automatically: a book added
 * to the catalogue may have been read long ago, and a made-up date would
 * distort reading statistics.
 *
 * **State invariants** (also enforced by CHECK constraints in the database):
 * - `0 <= pagesRead <= pageCount`, `startedAt <= finishedAt`;
 * - `WANT_TO_READ`: no progress, no reading dates, no rating;
 * - `READING`: no `finishedAt`;
 * - `READ`: `pagesRead = pageCount` (when the page count is known; it is
 *   filled in automatically unless `pagesRead` is given);
 * - reading dates are not in the future.
 */
import type { BookStatus } from "@prisma/client";

/** Fields governed by the reading rules. */
export interface ReadingState {
  status: BookStatus;
  pageCount: number | null;
  pagesRead: number;
  rating: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** A requested change of reading fields (`undefined` / missing = not given). */
export type ReadingPatch = { [K in keyof ReadingState]?: ReadingState[K] | undefined };

/** A rule violation: field name and message. */
export type ReadingIssue = [field: keyof ReadingState, message: string];

/** Result of {@link applyReadingRules}. */
export interface ReadingRulesResult {
  /** Final reading state after derived values were applied. */
  state: ReadingState;
  /** Violations of the state invariants; empty when the state is valid. */
  issues: ReadingIssue[];
}

/** Reading state of a newly created book before the input is applied. */
export const NEW_BOOK_READING_STATE: Readonly<ReadingState> = {
  status: "WANT_TO_READ",
  pageCount: null,
  pagesRead: 0,
  rating: null,
  startedAt: null,
  finishedAt: null,
};

/**
 * How far in the future a reading date may lie. Dates are often sent as plain
 * days (`2026-11-25` = midnight UTC), which can be "tomorrow" in UTC for a
 * user east of Greenwich, so one day of slack is allowed.
 */
export const FUTURE_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Applies the reading rules to a requested change.
 *
 * @param previous - Stored state of the book, or `null` when the book is being created.
 * @param patch - Reading fields given in the request.
 * @param now - Current time (injected for testability).
 * @returns The final state and any rule violations.
 */
export function applyReadingRules(previous: ReadingState | null, patch: ReadingPatch, now: Date): ReadingRulesResult {
  const isCreate = previous === null;
  // Copy only the reading fields: `previous` may be a full book record.
  const { status, pageCount, pagesRead, rating, startedAt, finishedAt } = previous ?? NEW_BOOK_READING_STATE;
  const base: ReadingState = { status, pageCount, pagesRead, rating, startedAt, finishedAt };
  const given = (field: keyof ReadingState): boolean => patch[field] !== undefined;

  const state: ReadingState = {
    status: patch.status ?? base.status,
    pageCount: patch.pageCount !== undefined ? patch.pageCount : base.pageCount,
    pagesRead: patch.pagesRead ?? base.pagesRead,
    rating: patch.rating !== undefined ? patch.rating : base.rating,
    startedAt: patch.startedAt !== undefined ? patch.startedAt : base.startedAt,
    finishedAt: patch.finishedAt !== undefined ? patch.finishedAt : base.finishedAt,
  };

  // 1. Derive the status from the reading progress.
  if (!given("status")) {
    if (state.status === "WANT_TO_READ" && state.pagesRead > 0) state.status = "READING";
    if (
      state.status === "READING" &&
      given("pagesRead") &&
      state.pageCount !== null &&
      state.pagesRead > 0 &&
      state.pagesRead === state.pageCount
    ) {
      state.status = "READ";
    }
  }

  // 2. Side effects of a status change.
  const statusChanged = state.status !== base.status;
  if (statusChanged && state.status === "WANT_TO_READ") {
    if (!given("pagesRead")) state.pagesRead = 0;
    if (!given("startedAt")) state.startedAt = null;
    if (!given("finishedAt")) state.finishedAt = null;
    if (!given("rating")) state.rating = null;
  }
  if (statusChanged && state.status === "READING") {
    const reRead = base.status === "READ";
    if (reRead && !given("pagesRead")) state.pagesRead = 0;
    if (!isCreate && !given("startedAt") && (reRead || state.startedAt === null)) state.startedAt = now;
    if (!given("finishedAt")) state.finishedAt = null;
  }
  if (statusChanged && state.status === "READ" && !isCreate && !given("finishedAt") && state.finishedAt === null) {
    state.finishedAt = now;
  }
  if (state.status === "READ" && state.pageCount !== null && !given("pagesRead")) {
    state.pagesRead = state.pageCount;
  }

  return { state, issues: readingStateIssues(state, patch, now) };
}

/**
 * Checks the invariants of a final reading state.
 *
 * @param state - State to check.
 * @param patch - Requested change (only given dates are checked against `now`).
 * @param now - Current time.
 * @returns Rule violations; empty when the state is valid.
 */
export function readingStateIssues(state: ReadingState, patch: ReadingPatch, now: Date): ReadingIssue[] {
  const issues: ReadingIssue[] = [];

  if (state.pageCount !== null && state.pagesRead > state.pageCount) {
    issues.push(["pagesRead", `pagesRead (${state.pagesRead}) cannot exceed pageCount (${state.pageCount})`]);
  }
  if (state.startedAt !== null && state.finishedAt !== null && state.finishedAt < state.startedAt) {
    issues.push(["finishedAt", "finishedAt cannot be earlier than startedAt"]);
  }
  for (const field of ["startedAt", "finishedAt"] as const) {
    const date = patch[field];
    if (date != null && date.getTime() > now.getTime() + FUTURE_DATE_TOLERANCE_MS) {
      issues.push([field, `${field} cannot be in the future`]);
    }
  }

  switch (state.status) {
    case "WANT_TO_READ":
      if (state.pagesRead > 0) issues.push(["pagesRead", "A WANT_TO_READ book cannot have reading progress"]);
      if (state.startedAt !== null) issues.push(["startedAt", "A WANT_TO_READ book cannot have startedAt"]);
      if (state.finishedAt !== null) issues.push(["finishedAt", "A WANT_TO_READ book cannot have finishedAt"]);
      if (state.rating !== null) issues.push(["rating", "Only books being read or already read can be rated"]);
      break;
    case "READING":
      if (state.finishedAt !== null) issues.push(["finishedAt", "finishedAt can only be set for READ books"]);
      break;
    case "READ":
      if (state.pageCount !== null && state.pagesRead !== state.pageCount) {
        issues.push(["pagesRead", `A READ book must have pagesRead equal to pageCount (${state.pageCount})`]);
      }
      break;
  }

  return issues;
}
