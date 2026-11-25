/**
 * @packageDocumentation
 * Reading statistics of the library (counts, ratings, books finished per
 * month of a year, currently read books, most used tags).
 *
 * Calendar months and years are computed in the owner's time zone
 * (`APP_TIMEZONE`): a book finished at 00:30 on 1 January in Warsaw counts
 * for the new year although it is still 31 December in UTC.
 */
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

/** Number of books per rating value. */
export interface RatingBucket {
  rating: number;
  count: number;
}

/** Books finished in one calendar month. */
export interface MonthBucket {
  /** Month 1–12. */
  month: number;
  books: number;
  /** Sum of the page counts of these books (books without a page count add 0). */
  pages: number;
}

/** A book that is being read, with its progress. */
export interface CurrentlyReadingBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  pagesRead: number;
  pageCount: number | null;
  startedAt: Date | null;
}

/** Body of `GET /api/stats`. */
export interface LibraryStats {
  totals: {
    books: number;
    wantToRead: number;
    reading: number;
    read: number;
    onShelf: number;
    offShelf: number;
    unassigned: number;
    /** Sum of `pagesRead` over all books (includes books in progress). */
    pagesRead: number;
  };
  ratings: {
    /** Mean rating of rated books, rounded to 2 decimals; `null` when nothing is rated. */
    average: number | null;
    rated: number;
    /** Always five buckets, rating 1 to 5. */
    distribution: RatingBucket[];
  };
  year: {
    year: number;
    booksFinished: number;
    pagesFinished: number;
    /** Always twelve buckets, January to December. */
    monthly: MonthBucket[];
    /** Years in which at least one book was finished (descending), plus the requested year. */
    availableYears: number[];
  };
  currentlyReading: CurrentlyReadingBook[];
  /** Most used tags (at most {@link TOP_TAGS_LIMIT}). */
  topTags: Array<{ tag: string; count: number }>;
}

/** Number of tags returned in `topTags`. */
export const TOP_TAGS_LIMIT = 8;
/** Number of books returned in `currentlyReading`. */
export const CURRENTLY_READING_LIMIT = 6;

/**
 * Returns the current calendar year in the owner's time zone.
 *
 * @param now - Current time.
 */
export function currentYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: env.APP_TIMEZONE, year: "numeric" }).format(now));
}

/**
 * SQL expression converting the UTC `finishedAt` column into local time.
 * Prisma stores `DateTime` as `timestamp without time zone` in UTC.
 */
const localFinishedAt = Prisma.sql`("finishedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${env.APP_TIMEZONE})`;

/**
 * Computes the library statistics.
 *
 * @param year - Calendar year of the monthly breakdown.
 * @returns The statistics.
 */
export async function getLibraryStats(year: number): Promise<LibraryStats> {
  const [byStatus, byLocation, pages, ratingGroups, ratingAverage, monthly, years, reading, tags] = await Promise.all([
    prisma.book.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.book.groupBy({ by: ["locationStatus"], _count: { _all: true } }),
    prisma.book.aggregate({ _sum: { pagesRead: true } }),
    prisma.book.groupBy({ by: ["rating"], where: { rating: { not: null } }, _count: { _all: true } }),
    prisma.book.aggregate({ where: { rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.$queryRaw<Array<{ month: number; books: number; pages: number }>>`
      SELECT EXTRACT(MONTH FROM ${localFinishedAt})::int AS "month",
             COUNT(*)::int AS "books",
             COALESCE(SUM("pageCount"), 0)::int AS "pages"
      FROM "Book"
      WHERE "status" = 'READ' AND "finishedAt" IS NOT NULL
        AND EXTRACT(YEAR FROM ${localFinishedAt}) = ${year}
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ year: number }>>`
      SELECT DISTINCT EXTRACT(YEAR FROM ${localFinishedAt})::int AS "year"
      FROM "Book"
      WHERE "status" = 'READ' AND "finishedAt" IS NOT NULL`,
    prisma.book.findMany({
      where: { status: "READING" },
      select: { id: true, title: true, author: true, coverUrl: true, pagesRead: true, pageCount: true, startedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: CURRENTLY_READING_LIMIT,
    }),
    prisma.$queryRaw<Array<{ tag: string; count: number }>>`
      SELECT "tag", COUNT(*)::int AS "count"
      FROM "Book", unnest("tags") AS "tag"
      GROUP BY "tag"
      ORDER BY "count" DESC, "tag" ASC
      LIMIT ${TOP_TAGS_LIMIT}`,
  ]);

  const statusCount = (status: string) => byStatus.find((group) => group.status === status)?._count._all ?? 0;
  const locationCount = (location: string) =>
    byLocation.find((group) => group.locationStatus === location)?._count._all ?? 0;

  const monthlyBuckets: MonthBucket[] = Array.from({ length: 12 }, (_, index) => {
    const row = monthly.find((entry) => entry.month === index + 1);
    return { month: index + 1, books: row?.books ?? 0, pages: row?.pages ?? 0 };
  });

  const average = ratingAverage._avg.rating;

  return {
    totals: {
      books: byStatus.reduce((sum, group) => sum + group._count._all, 0),
      wantToRead: statusCount("WANT_TO_READ"),
      reading: statusCount("READING"),
      read: statusCount("READ"),
      onShelf: locationCount("ON_SHELF"),
      offShelf: locationCount("OFF_SHELF"),
      unassigned: locationCount("UNASSIGNED"),
      pagesRead: pages._sum.pagesRead ?? 0,
    },
    ratings: {
      average: average === null ? null : Math.round(average * 100) / 100,
      rated: ratingAverage._count.rating,
      distribution: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: ratingGroups.find((group) => group.rating === rating)?._count._all ?? 0,
      })),
    },
    year: {
      year,
      booksFinished: monthlyBuckets.reduce((sum, bucket) => sum + bucket.books, 0),
      pagesFinished: monthlyBuckets.reduce((sum, bucket) => sum + bucket.pages, 0),
      monthly: monthlyBuckets,
      availableYears: [...new Set([year, ...years.map((row) => row.year)])].sort((a, b) => b - a),
    },
    currentlyReading: reading,
    topTags: tags,
  };
}
