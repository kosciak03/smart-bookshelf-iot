/**
 * @packageDocumentation
 * Normalized book metadata returned by ISBN lookups, the provider contract and
 * helpers that clean raw values from external APIs so they satisfy the
 * validation rules of the `Book` model.
 */

/** Identifier of an external metadata source. */
export type MetadataSource = "google-books" | "open-library";

/**
 * Book metadata normalized to the fields of the `Book` model.
 * Values are already sanitized (lengths, ranges, HTTPS URLs).
 */
export interface BookMetadata {
  /** Normalized ISBN-13 that was looked up. */
  isbn: string;
  /** Title, including the subtitle when the source provides one. */
  title: string;
  /** Authors joined with ", " (display string stored in `Book.author`); `null` when unknown. */
  author: string | null;
  /** Individual author names. */
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  /** Subject categories (lower-case, at most {@link MAX_TAGS}). */
  tags: string[];
  /** Source the data comes from. */
  source: MetadataSource;
}

/** A source of book metadata (Google Books, Open Library, test doubles). */
export interface MetadataProvider {
  /** Source identifier reported in {@link BookMetadata.source}. */
  readonly name: MetadataSource;
  /**
   * Looks up a book by ISBN.
   *
   * @param isbn - Normalized ISBN-13.
   * @returns Metadata, or `null` when the source does not know the ISBN.
   * @throws {@link ProviderError} when the source is unreachable or answers with an error.
   */
  lookup(isbn: string): Promise<BookMetadata | null>;
}

/** Raised by a provider when its source cannot be queried successfully. */
export class ProviderError extends Error {
  /**
   * @param source - Failing source.
   * @param message - Description of the failure (e.g. `HTTP 429`, `timeout`).
   */
  constructor(
    readonly source: MetadataSource,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Limits mirroring the `Book` zod schema. */
export const MAX_TITLE_LENGTH = 500;
export const MAX_AUTHOR_LENGTH = 500;
export const MAX_PUBLISHER_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 10_000;
export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 50;

/**
 * Trims a string, collapses whitespace, removes HTML tags and truncates it.
 *
 * @param value - Raw value (non-strings yield `null`).
 * @param maxLength - Maximum length of the result.
 * @returns The cleaned string, or `null` when empty.
 */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length === 0) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/**
 * Extracts a plausible publication year from free-form dates such as
 * `2008`, `2008-08-01`, `July 2008` or `c1994` (copyright notation).
 *
 * @param value - Raw date string.
 * @returns Year between 1450 and 2100, or `null`.
 */
export function parseYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /(?<!\d)(1[4-9]\d{2}|20\d{2}|2100)(?!\d)/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1450 && year <= 2100 ? year : null;
}

/**
 * Accepts only positive, realistic page counts.
 *
 * @param value - Raw page count.
 * @returns Page count, or `null` when missing or implausible.
 */
export function parsePageCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100_000 ? value : null;
}

/**
 * Converts a URL to HTTPS and validates it.
 *
 * @param value - Raw URL.
 * @returns HTTPS URL, or `null` when missing or invalid.
 */
export function toHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value.replace(/^http:\/\//i, "https://"));
    return url.protocol === "https:" && url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Normalizes subject names to tags: lower-case, trimmed, de-duplicated, limited.
 *
 * @param values - Raw subject names.
 * @returns At most {@link MAX_TAGS} tags.
 */
export function normalizeTags(values: readonly unknown[]): string[] {
  const tags = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0 && value.length <= MAX_TAG_LENGTH);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

/**
 * Joins author names into the display string stored in `Book.author`.
 *
 * @param authors - Individual names.
 * @returns Comma-separated names (truncated to the column limit).
 */
export function joinAuthors(authors: readonly string[]): string {
  return cleanText(authors.join(", "), MAX_AUTHOR_LENGTH) ?? "";
}
