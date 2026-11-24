/**
 * @packageDocumentation
 * Open Library Books API provider
 * (`GET /api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data`).
 *
 * The `data` view has no description, so `description` is always `null`.
 *
 * @see https://openlibrary.org/dev/docs/api/books
 */
import { z } from "zod";
import {
  MAX_PUBLISHER_LENGTH,
  MAX_TITLE_LENGTH,
  ProviderError,
  cleanText,
  joinAuthors,
  normalizeTags,
  parsePageCount,
  parseYear,
  toHttpsUrl,
  type BookMetadata,
  type MetadataProvider,
} from "../metadata.types.js";
import { fetchJson } from "./fetch-json.js";

/** Base URL of the Books API. */
const OPEN_LIBRARY_URL = "https://openlibrary.org/api/books";

/** Object with a `name` property (authors, publishers, subjects). */
const namedSchema = z.object({ name: z.string() });

/** Subset of a single Open Library book record (`jscmd=data`). */
const bookRecordSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  authors: z.array(namedSchema).optional(),
  publishers: z.array(namedSchema).optional(),
  publish_date: z.string().optional(),
  number_of_pages: z.number().optional(),
  subjects: z.array(namedSchema).optional(),
  cover: z.object({ small: z.string().optional(), medium: z.string().optional(), large: z.string().optional() }).optional(),
});

/** Response: an object keyed by `ISBN:<isbn>`; empty when the ISBN is unknown. */
const booksResponseSchema = z.record(z.string(), bookRecordSchema);

/** Parsed Open Library book record. */
export type OpenLibraryRecord = z.infer<typeof bookRecordSchema>;

/** Options of {@link OpenLibraryProvider}. */
export interface OpenLibraryProviderOptions {
  /** Request timeout in milliseconds. */
  timeoutMs: number;
}

/**
 * Maps an Open Library record to normalized metadata.
 *
 * @param record - Parsed record.
 * @param isbn - Requested ISBN-13.
 * @returns Metadata, or `null` when the record has no title.
 */
export function mapOpenLibraryRecord(record: OpenLibraryRecord, isbn: string): BookMetadata | null {
  const title = cleanText(record.subtitle ? `${record.title ?? ""}: ${record.subtitle}` : record.title, MAX_TITLE_LENGTH);
  if (title === null || title.startsWith(":")) return null;

  const authors = (record.authors ?? []).map((author) => author.name.trim()).filter(Boolean);

  return {
    isbn,
    title,
    author: authors.length > 0 ? joinAuthors(authors) : null,
    authors,
    description: null,
    coverUrl: toHttpsUrl(record.cover?.large ?? record.cover?.medium ?? record.cover?.small),
    publisher: cleanText(record.publishers?.[0]?.name, MAX_PUBLISHER_LENGTH),
    publishedYear: parseYear(record.publish_date),
    pageCount: parsePageCount(record.number_of_pages),
    tags: normalizeTags((record.subjects ?? []).map((subject) => subject.name)),
    source: "open-library",
  };
}

/** Metadata provider backed by the Open Library Books API. */
export class OpenLibraryProvider implements MetadataProvider {
  readonly name = "open-library" as const;

  /**
   * @param options - Request timeout.
   */
  constructor(private readonly options: OpenLibraryProviderOptions) {}

  /** @inheritDoc */
  async lookup(isbn: string): Promise<BookMetadata | null> {
    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("bibkeys", `ISBN:${isbn}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("jscmd", "data");

    const json = await fetchJson(this.name, url.href, this.options.timeoutMs);
    const parsed = booksResponseSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError(this.name, "unexpected response format");

    const record = parsed.data[`ISBN:${isbn}`];
    return record ? mapOpenLibraryRecord(record, isbn) : null;
  }
}
