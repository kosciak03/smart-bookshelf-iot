/**
 * @packageDocumentation
 * Sample data for local development: the five slots of the prototype shelf
 * and a handful of books covering every reading and location status.
 *
 * All values (including dates) are constants, so seeding is deterministic.
 */
import type { BookStatus, LocationStatus } from "@prisma/client";

/**
 * Number of WS2812B LEDs assigned to each slot.
 * Adjust to the physical strip once the final shelf width is known.
 */
export const LEDS_PER_SLOT = 8;

/** Definition of a shelf slot to be seeded. */
export interface SeedSlot {
  slotNumber: number;
  fsrChannel: number;
  ledStartIdx: number;
  ledEndIdx: number;
}

/**
 * Five slots of shelf 1. FSR channel `n` is wired to FSR_(n+1)
 * (GPIO 34, 35, 32, 33, 36 — see AGENTS.md).
 */
export const SEED_SLOTS: readonly SeedSlot[] = Array.from({ length: 5 }, (_, index) => ({
  slotNumber: index + 1,
  fsrChannel: index,
  ledStartIdx: index * LEDS_PER_SLOT,
  ledEndIdx: index * LEDS_PER_SLOT + LEDS_PER_SLOT - 1,
}));

/** Definition of a book to be seeded. */
export interface SeedBook {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: number;
  pageCount: number;
  tags: string[];
  status: BookStatus;
  pagesRead: number;
  rating: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  locationStatus: LocationStatus;
  /** Slot number on shelf 1 (`null` = no slot assigned). */
  slotNumber: number | null;
  rfidUid: string | null;
}

/**
 * Builds the Open Library cover URL for an ISBN.
 *
 * @param isbn - Normalized ISBN-13.
 * @returns URL of the large cover image.
 */
export function openLibraryCoverUrl(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

/**
 * Sample books. Slots 1, 3 and 4 hold books (ON_SHELF), the book of slot 2 is
 * currently being read (OFF_SHELF) and slot 5 is free.
 */
export const SEED_BOOKS: readonly SeedBook[] = [
  {
    isbn: "9780132350884",
    title: "Clean Code: A Handbook of Agile Software Craftsmanship",
    author: "Robert C. Martin",
    publisher: "Prentice Hall",
    publishedYear: 2008,
    pageCount: 464,
    tags: ["programming", "software engineering"],
    status: "READ",
    pagesRead: 464,
    rating: 5,
    startedAt: new Date("2026-09-01T00:00:00Z"),
    finishedAt: new Date("2026-10-05T00:00:00Z"),
    locationStatus: "ON_SHELF",
    slotNumber: 1,
    rfidUid: "04A1B2C3D4E501",
  },
  {
    isbn: "9780135957059",
    title: "The Pragmatic Programmer: Your Journey to Mastery (20th Anniversary Edition)",
    author: "David Thomas, Andrew Hunt",
    publisher: "Addison-Wesley",
    publishedYear: 2019,
    pageCount: 352,
    tags: ["programming", "career"],
    status: "READING",
    pagesRead: 140,
    rating: null,
    startedAt: new Date("2026-11-10T00:00:00Z"),
    finishedAt: null,
    locationStatus: "OFF_SHELF",
    slotNumber: 2,
    rfidUid: "04A1B2C3D4E502",
  },
  {
    isbn: "9780201633610",
    title: "Design Patterns: Elements of Reusable Object-Oriented Software",
    author: "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
    publisher: "Addison-Wesley",
    publishedYear: 1994,
    pageCount: 395,
    tags: ["programming", "design patterns"],
    status: "WANT_TO_READ",
    pagesRead: 0,
    rating: null,
    startedAt: null,
    finishedAt: null,
    locationStatus: "ON_SHELF",
    slotNumber: 3,
    rfidUid: "04A1B2C3D4E503",
  },
  {
    isbn: "9780262033848",
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein",
    publisher: "MIT Press",
    publishedYear: 2009,
    pageCount: 1312,
    tags: ["algorithms", "computer science"],
    status: "READ",
    pagesRead: 1312,
    rating: 4,
    startedAt: new Date("2025-10-01T00:00:00Z"),
    finishedAt: new Date("2026-02-20T00:00:00Z"),
    locationStatus: "ON_SHELF",
    slotNumber: 4,
    rfidUid: "04A1B2C3D4E504",
  },
  {
    isbn: "9780441172719",
    title: "Dune",
    author: "Frank Herbert",
    publisher: "Ace Books",
    publishedYear: 1990,
    pageCount: 535,
    tags: ["fiction", "science fiction"],
    status: "READING",
    pagesRead: 210,
    rating: null,
    startedAt: new Date("2026-11-01T00:00:00Z"),
    finishedAt: null,
    locationStatus: "UNASSIGNED",
    slotNumber: null,
    rfidUid: null,
  },
  {
    isbn: "9780547928227",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    publisher: "Houghton Mifflin Harcourt",
    publishedYear: 2012,
    pageCount: 300,
    tags: ["fiction", "fantasy"],
    status: "WANT_TO_READ",
    pagesRead: 0,
    rating: null,
    startedAt: null,
    finishedAt: null,
    locationStatus: "UNASSIGNED",
    slotNumber: null,
    rfidUid: null,
  },
  {
    isbn: "9780134757599",
    title: "Refactoring: Improving the Design of Existing Code",
    author: "Martin Fowler",
    publisher: "Addison-Wesley",
    publishedYear: 2018,
    pageCount: 448,
    tags: ["programming", "software engineering"],
    status: "READ",
    pagesRead: 448,
    rating: 4,
    startedAt: new Date("2026-03-01T00:00:00Z"),
    finishedAt: new Date("2026-04-15T00:00:00Z"),
    locationStatus: "UNASSIGNED",
    slotNumber: null,
    rfidUid: null,
  },
];
