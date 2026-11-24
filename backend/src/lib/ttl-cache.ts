/**
 * @packageDocumentation
 * Minimal in-memory cache with per-entry expiry and a size limit.
 *
 * Used to avoid repeated calls to external book metadata APIs. Data is lost on
 * restart, which is acceptable for a single-instance development backend.
 */

/** Stored value together with its expiry time. */
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/** Options of {@link TtlCache}. */
export interface TtlCacheOptions {
  /** Default time to live of an entry, in milliseconds. */
  ttlMs: number;
  /** Maximum number of entries; the oldest entry is evicted when exceeded. */
  maxEntries: number;
  /** Time source in milliseconds (injectable for tests). Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Key-value cache whose entries expire after a configurable time.
 *
 * @typeParam K - Key type.
 * @typeParam V - Value type.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  /**
   * @param options - TTL, size limit and optional clock.
   */
  constructor(options: TtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
    this.now = options.now ?? Date.now;
  }

  /**
   * Returns a value if present and not expired (expired entries are removed).
   *
   * @param key - Cache key.
   * @returns The cached value, or `undefined` on a miss.
   */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Stores a value. When the cache is full, the oldest inserted entry is evicted.
   *
   * @param key - Cache key.
   * @param value - Value to store.
   * @param ttlMs - Optional TTL overriding the default one.
   */
  set(key: K, value: V, ttlMs: number = this.ttlMs): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next();
      if (!oldestKey.done) this.entries.delete(oldestKey.value);
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  /** Removes all entries. */
  clear(): void {
    this.entries.clear();
  }

  /** Number of stored entries (including not yet purged expired ones). */
  get size(): number {
    return this.entries.size;
  }
}
