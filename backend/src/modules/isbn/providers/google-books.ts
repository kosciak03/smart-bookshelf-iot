/**
 * @packageDocumentation
 * Google Books API provider (`GET /books/v1/volumes?q=isbn:<isbn>`).
 *
 * @see https://developers.google.com/books/docs/v1/using
 */
import { z } from "zod";
import { normalizeIsbn } from "../../../lib/isbn.js";
import {
  MAX_DESCRIPTION_LENGTH,
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

/** Base URL of the volumes endpoint. */
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

/** Subset of the Google Books `volumeInfo` object used by the application. */
const volumeInfoSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  pageCount: z.number().optional(),
  categories: z.array(z.string()).optional(),
  industryIdentifiers: z.array(z.object({ type: z.string(), identifier: z.string() })).optional(),
  imageLinks: z.object({ thumbnail: z.string().optional(), smallThumbnail: z.string().optional() }).optional(),
});

/** Subset of the volumes search response. */
const volumesResponseSchema = z.object({
  totalItems: z.number().optional(),
  items: z.array(z.object({ volumeInfo: volumeInfoSchema })).optional(),
});

/** Parsed `volumeInfo`. */
export type GoogleVolumeInfo = z.infer<typeof volumeInfoSchema>;

/** Options of {@link GoogleBooksProvider}. */
export interface GoogleBooksProviderOptions {
  /** Optional API key (raises the request quota). */
  apiKey?: string | undefined;
  /** Request timeout in milliseconds. */
  timeoutMs: number;
}

/**
 * Picks the volume whose identifiers match the requested ISBN. Google may
 * return loosely related volumes, so a volume is accepted only when it lists
 * the ISBN, or when it is the only result and has no identifiers at all.
 *
 * @param volumes - Volumes from the search response.
 * @param isbn - Requested ISBN-13.
 * @returns The matching volume, or `undefined`.
 */
function pickVolume(volumes: readonly GoogleVolumeInfo[], isbn: string): GoogleVolumeInfo | undefined {
  const matching = volumes.find((volume) =>
    (volume.industryIdentifiers ?? []).some((id) => normalizeIsbn(id.identifier) === isbn),
  );
  if (matching) return matching;
  const [only] = volumes;
  return volumes.length === 1 && only && !only.industryIdentifiers?.length ? only : undefined;
}

/**
 * Maps a Google Books volume to normalized metadata.
 *
 * @param volume - Parsed `volumeInfo`.
 * @param isbn - Requested ISBN-13.
 * @returns Metadata, or `null` when the volume has no title.
 */
export function mapGoogleVolume(volume: GoogleVolumeInfo, isbn: string): BookMetadata | null {
  const title = cleanText(
    volume.subtitle ? `${volume.title ?? ""}: ${volume.subtitle}` : volume.title,
    MAX_TITLE_LENGTH,
  );
  if (title === null || title.startsWith(":")) return null;

  const authors = (volume.authors ?? []).map((name) => name.trim()).filter(Boolean);
  // "edge=curl" adds a page-curl effect to the thumbnail; remove it.
  const thumbnail = (volume.imageLinks?.thumbnail ?? volume.imageLinks?.smallThumbnail)?.replace(/&edge=curl/g, "");

  return {
    isbn,
    title,
    author: authors.length > 0 ? joinAuthors(authors) : null,
    authors,
    description: cleanText(volume.description, MAX_DESCRIPTION_LENGTH),
    coverUrl: toHttpsUrl(thumbnail),
    publisher: cleanText(volume.publisher, MAX_PUBLISHER_LENGTH),
    publishedYear: parseYear(volume.publishedDate),
    pageCount: parsePageCount(volume.pageCount),
    tags: normalizeTags(volume.categories ?? []),
    source: "google-books",
  };
}

/** Metadata provider backed by the Google Books API. */
export class GoogleBooksProvider implements MetadataProvider {
  readonly name = "google-books" as const;

  /**
   * @param options - API key and timeout.
   */
  constructor(private readonly options: GoogleBooksProviderOptions) {}

  /** @inheritDoc */
  async lookup(isbn: string): Promise<BookMetadata | null> {
    const url = new URL(GOOGLE_BOOKS_URL);
    url.searchParams.set("q", `isbn:${isbn}`);
    url.searchParams.set("maxResults", "5");
    if (this.options.apiKey) url.searchParams.set("key", this.options.apiKey);

    const json = await fetchJson(this.name, url.href, this.options.timeoutMs);
    const parsed = volumesResponseSchema.safeParse(json);
    if (!parsed.success) throw new ProviderError(this.name, "unexpected response format");

    const volume = pickVolume(
      (parsed.data.items ?? []).map((item) => item.volumeInfo),
      isbn,
    );
    return volume ? mapGoogleVolume(volume, isbn) : null;
  }
}
