/**
 * @packageDocumentation
 * Shared HTTP helper for metadata providers: JSON GET with a timeout and
 * uniform error reporting via {@link ProviderError}.
 */
import { ProviderError, type MetadataSource } from "../metadata.types.js";

/** Generic client identification sent to external APIs (no personal data). */
const USER_AGENT = "SmartBookshelf/0.1 (engineering thesis prototype)";

/**
 * Fetches a URL and parses the JSON body.
 *
 * @param source - Provider name used in error messages.
 * @param url - URL to request.
 * @param timeoutMs - Abort the request after this many milliseconds.
 * @returns The parsed JSON value.
 * @throws {@link ProviderError} on network errors, timeouts, non-2xx responses or invalid JSON.
 */
export async function fetchJson(source: MetadataSource, url: string, timeoutMs: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? `timeout after ${timeoutMs} ms` : "network error";
    throw new ProviderError(source, reason);
  }

  if (!response.ok) {
    throw new ProviderError(source, `HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new ProviderError(source, "invalid JSON response");
  }
}
