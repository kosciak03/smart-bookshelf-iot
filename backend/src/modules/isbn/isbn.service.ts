/**
 * @packageDocumentation
 * ISBN metadata lookup with provider fallback and an in-memory TTL cache.
 *
 * Providers are queried in order (Google Books, then Open Library); the first
 * hit wins. Outcomes:
 *
 * | Provider results                         | Result              | Cached          |
 * | ---------------------------------------- | ------------------- | --------------- |
 * | any provider returns metadata            | metadata            | yes (long TTL)  |
 * | every provider answers "not found"       | 404 ISBN_NOT_FOUND  | yes (short TTL) |
 * | some answer "not found", others fail     | 404 + failed list   | no              |
 * | every provider fails (HTTP error, …)     | 502 SOURCE_UNAVAIL. | no              |
 */
import { env } from "../../config/env.js";
import { IsbnNotFoundError, MetadataSourceUnavailableError, type ErrorDetail } from "../../lib/http-errors.js";
import { TtlCache } from "../../lib/ttl-cache.js";
import { ProviderError, type BookMetadata, type MetadataProvider } from "./metadata.types.js";
import { GoogleBooksProvider } from "./providers/google-books.js";
import { OpenLibraryProvider } from "./providers/open-library.js";

/** Result of a successful lookup. */
export interface IsbnLookupResult {
  metadata: BookMetadata;
  /** `true` when served from the cache without contacting any source. */
  cached: boolean;
}

/** Options of {@link IsbnLookupService}. */
export interface IsbnLookupServiceOptions {
  /** Providers in priority order. */
  providers: readonly MetadataProvider[];
  /** Cache of found metadata (`null` = known "not found"). */
  cache: TtlCache<string, BookMetadata | null>;
  /** TTL of "not found" entries in milliseconds. */
  negativeTtlMs: number;
}

/** Looks up book metadata by ISBN using several providers. */
export class IsbnLookupService {
  /**
   * @param options - Providers, cache and negative-cache TTL.
   */
  constructor(private readonly options: IsbnLookupServiceOptions) {}

  /**
   * Returns metadata for an ISBN.
   *
   * @param isbn - Normalized ISBN-13.
   * @returns Metadata and whether it came from the cache.
   * @throws {@link IsbnNotFoundError} (404) when no source knows the ISBN.
   * @throws {@link MetadataSourceUnavailableError} (502) when every source failed.
   */
  async lookup(isbn: string): Promise<IsbnLookupResult> {
    const { providers, cache, negativeTtlMs } = this.options;

    const cachedValue = cache.get(isbn);
    if (cachedValue === null) throw new IsbnNotFoundError(isbn);
    if (cachedValue !== undefined) return { metadata: cachedValue, cached: true };

    const failures: ErrorDetail[] = [];
    for (const provider of providers) {
      try {
        const metadata = await provider.lookup(isbn);
        if (metadata !== null) {
          cache.set(isbn, metadata);
          return { metadata, cached: false };
        }
      } catch (error) {
        const message = error instanceof ProviderError ? error.message : "unexpected error";
        console.warn(`[isbn] ${provider.name} lookup failed for ${isbn}: ${message}`);
        failures.push({ path: provider.name, message });
      }
    }

    if (failures.length === providers.length) throw new MetadataSourceUnavailableError(isbn, failures);
    if (failures.length === 0) {
      cache.set(isbn, null, negativeTtlMs);
      throw new IsbnNotFoundError(isbn);
    }
    throw new IsbnNotFoundError(isbn, failures);
  }

  /** Empties the cache (used by tests and for manual refreshes). */
  clearCache(): void {
    this.options.cache.clear();
  }
}

/** Application-wide lookup service configured from environment variables. */
export const isbnLookupService = new IsbnLookupService({
  providers: [
    new GoogleBooksProvider({ apiKey: env.GOOGLE_BOOKS_API_KEY, timeoutMs: env.ISBN_LOOKUP_TIMEOUT_MS }),
    new OpenLibraryProvider({ timeoutMs: env.ISBN_LOOKUP_TIMEOUT_MS }),
  ],
  cache: new TtlCache({ ttlMs: env.ISBN_CACHE_TTL_SECONDS * 1000, maxEntries: env.ISBN_CACHE_MAX_ENTRIES }),
  negativeTtlMs: env.ISBN_NEGATIVE_CACHE_TTL_SECONDS * 1000,
});
