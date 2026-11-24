/**
 * @packageDocumentation
 * Unit tests for the in-memory TTL cache.
 */
import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache.js";

/**
 * Creates a cache driven by a manual clock.
 *
 * @param maxEntries - Size limit.
 * @returns The cache and a function advancing the clock.
 */
function createCache(maxEntries = 10) {
  let now = 0;
  const cache = new TtlCache<string, number>({ ttlMs: 1000, maxEntries, now: () => now });
  return { cache, advance: (ms: number) => (now += ms) };
}

describe("TtlCache", () => {
  it("returns stored values until they expire", () => {
    const { cache, advance } = createCache();
    cache.set("a", 1);

    advance(999);
    expect(cache.get("a")).toBe(1);

    advance(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("supports a per-entry TTL", () => {
    const { cache, advance } = createCache();
    cache.set("short", 1, 100);
    cache.set("default", 2);

    advance(100);
    expect(cache.get("short")).toBeUndefined();
    expect(cache.get("default")).toBe(2);
  });

  it("evicts the oldest entry when full", () => {
    const { cache } = createCache(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("treats re-setting a key as the newest entry", () => {
    const { cache } = createCache(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10);
    cache.set("c", 3);

    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
  });

  it("can be cleared", () => {
    const { cache } = createCache();
    cache.set("a", 1);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
});
