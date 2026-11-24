/**
 * @packageDocumentation
 * Unit tests of the helpers that sanitize external metadata.
 */
import { describe, expect, it } from "vitest";
import { cleanText, normalizeTags, parsePageCount, parseYear, toHttpsUrl } from "./metadata.types.js";

describe("metadata sanitizers", () => {
  it("cleanText strips HTML, collapses whitespace and truncates", () => {
    expect(cleanText("  <p>Hello   <i>world</i></p> ", 100)).toBe("Hello world");
    expect(cleanText("abcdef", 4)).toBe("abc…");
    expect(cleanText("   ", 10)).toBeNull();
    expect(cleanText(42, 10)).toBeNull();
  });

  it("parseYear extracts a plausible year from free-form dates", () => {
    expect(parseYear("2008-08-01")).toBe(2008);
    expect(parseYear("July 2008")).toBe(2008);
    expect(parseYear("c1994")).toBe(1994);
    expect(parseYear("1994?")).toBe(1994);
    expect(parseYear("unknown")).toBeNull();
    expect(parseYear("1200")).toBeNull();
    expect(parseYear("ISBN 97801323")).toBeNull();
  });

  it("parsePageCount accepts only positive integers", () => {
    expect(parsePageCount(464)).toBe(464);
    expect(parsePageCount(0)).toBeNull();
    expect(parsePageCount(12.5)).toBeNull();
    expect(parsePageCount("464")).toBeNull();
  });

  it("toHttpsUrl upgrades http and rejects invalid URLs", () => {
    expect(toHttpsUrl("http://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    expect(toHttpsUrl("not a url")).toBeNull();
    expect(toHttpsUrl("ftp://example.com/a.jpg")).toBeNull();
    expect(toHttpsUrl(undefined)).toBeNull();
  });

  it("normalizeTags lower-cases, de-duplicates and limits tags", () => {
    expect(normalizeTags([" Fiction ", "fiction", "Fantasy", "", "x".repeat(51)])).toEqual(["fiction", "fantasy"]);
    expect(normalizeTags(["a", "b", "c", "d", "e", "f"])).toHaveLength(5);
  });
});
