/**
 * @packageDocumentation
 * Unit tests of the lookup service: provider fallback, error mapping and caching.
 */
import { describe, expect, it, vi } from "vitest";
import { IsbnNotFoundError, MetadataSourceUnavailableError } from "../../lib/http-errors.js";
import { TtlCache } from "../../lib/ttl-cache.js";
import { IsbnLookupService } from "./isbn.service.js";
import { ProviderError, type BookMetadata, type MetadataProvider, type MetadataSource } from "./metadata.types.js";

const ISBN = "9780132350884";

/**
 * Builds metadata attributed to a source.
 *
 * @param source - Source name.
 * @returns Sample metadata.
 */
function metadataFrom(source: MetadataSource): BookMetadata {
  return {
    isbn: ISBN,
    title: "Clean Code",
    author: "Robert C. Martin",
    authors: ["Robert C. Martin"],
    description: null,
    coverUrl: null,
    publisher: null,
    publishedYear: 2008,
    pageCount: 464,
    tags: [],
    source,
  };
}

/** Behaviour of a fake provider. */
type FakeBehaviour = "hit" | "miss" | "fail";

/**
 * Creates a fake provider with a spied `lookup`.
 *
 * @param name - Source name.
 * @param behaviour - Whether it finds the book, misses or fails.
 * @returns The provider.
 */
function fakeProvider(name: MetadataSource, behaviour: FakeBehaviour): MetadataProvider & { lookup: ReturnType<typeof vi.fn> } {
  return {
    name,
    lookup: vi.fn(async () => {
      if (behaviour === "fail") throw new ProviderError(name, "HTTP 429");
      return behaviour === "hit" ? metadataFrom(name) : null;
    }),
  };
}

/**
 * Creates a service with two fake providers and a manual clock.
 *
 * @param google - Behaviour of the first provider.
 * @param openLibrary - Behaviour of the second provider.
 * @returns Service, providers and a clock control.
 */
function setup(google: FakeBehaviour, openLibrary: FakeBehaviour) {
  let now = 0;
  const providers = [fakeProvider("google-books", google), fakeProvider("open-library", openLibrary)] as const;
  const service = new IsbnLookupService({
    providers,
    cache: new TtlCache({ ttlMs: 10_000, maxEntries: 10, now: () => now }),
    negativeTtlMs: 1_000,
  });
  return { service, providers, advance: (ms: number) => (now += ms) };
}

describe("IsbnLookupService", () => {
  it("uses the first provider when it finds the book", async () => {
    const { service, providers } = setup("hit", "hit");
    await expect(service.lookup(ISBN)).resolves.toEqual({ metadata: metadataFrom("google-books"), cached: false });
    expect(providers[1].lookup).not.toHaveBeenCalled();
  });

  it.each<[FakeBehaviour]>([["miss"], ["fail"]])("falls back to Open Library when Google Books results in '%s'", async (google) => {
    const { service } = setup(google, "hit");
    const { metadata } = await service.lookup(ISBN);
    expect(metadata.source).toBe("open-library");
  });

  it("throws 404 when every source answers 'not found'", async () => {
    const { service } = setup("miss", "miss");
    await expect(service.lookup(ISBN)).rejects.toBeInstanceOf(IsbnNotFoundError);
  });

  it("throws 404 listing failed sources when the result may be incomplete", async () => {
    const { service } = setup("fail", "miss");
    const error = await service.lookup(ISBN).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IsbnNotFoundError);
    expect((error as IsbnNotFoundError).details).toEqual([{ path: "google-books", message: "HTTP 429" }]);
  });

  it("throws 502 when every source fails", async () => {
    const { service } = setup("fail", "fail");
    const error = await service.lookup(ISBN).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MetadataSourceUnavailableError);
    expect((error as MetadataSourceUnavailableError).status).toBe(502);
  });

  it("serves repeated lookups from the cache until the TTL expires", async () => {
    const { service, providers, advance } = setup("hit", "hit");
    await service.lookup(ISBN);
    await expect(service.lookup(ISBN)).resolves.toMatchObject({ cached: true });
    expect(providers[0].lookup).toHaveBeenCalledTimes(1);

    advance(10_000);
    await expect(service.lookup(ISBN)).resolves.toMatchObject({ cached: false });
    expect(providers[0].lookup).toHaveBeenCalledTimes(2);
  });

  it("caches a definitive 'not found' with the short TTL", async () => {
    const { service, providers, advance } = setup("miss", "miss");
    await expect(service.lookup(ISBN)).rejects.toBeInstanceOf(IsbnNotFoundError);
    await expect(service.lookup(ISBN)).rejects.toBeInstanceOf(IsbnNotFoundError);
    expect(providers[0].lookup).toHaveBeenCalledTimes(1);

    advance(1_000);
    await expect(service.lookup(ISBN)).rejects.toBeInstanceOf(IsbnNotFoundError);
    expect(providers[0].lookup).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const { service, providers } = setup("fail", "fail");
    await expect(service.lookup(ISBN)).rejects.toBeInstanceOf(MetadataSourceUnavailableError);
    await expect(service.lookup(ISBN)).rejects.toBeInstanceOf(MetadataSourceUnavailableError);
    expect(providers[0].lookup).toHaveBeenCalledTimes(2);
  });
});
