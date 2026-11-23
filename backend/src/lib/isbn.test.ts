/**
 * @packageDocumentation
 * Unit tests for the ISBN helpers.
 */
import { describe, expect, it } from "vitest";
import { isValidIsbn10, isValidIsbn13, normalizeIsbn } from "./isbn.js";

describe("isValidIsbn13", () => {
  it("accepts a valid ISBN-13", () => {
    expect(isValidIsbn13("9780132350884")).toBe(true);
  });

  it("rejects a wrong check digit, wrong length and non-digits", () => {
    expect(isValidIsbn13("9780132350885")).toBe(false);
    expect(isValidIsbn13("978013235088")).toBe(false);
    expect(isValidIsbn13("97801323508X4")).toBe(false);
  });
});

describe("isValidIsbn10", () => {
  it("accepts valid ISBN-10 values, including the X check digit", () => {
    expect(isValidIsbn10("0132350882")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidIsbn10("0132350883")).toBe(false);
  });
});

describe("normalizeIsbn", () => {
  it("strips hyphens and spaces", () => {
    expect(normalizeIsbn("978-0-13-235088-4")).toBe("9780132350884");
    expect(normalizeIsbn(" 978 0132350884 ")).toBe("9780132350884");
  });

  it("converts ISBN-10 to ISBN-13", () => {
    expect(normalizeIsbn("0-13-235088-2")).toBe("9780132350884");
    expect(normalizeIsbn("080442957x")).toBe("9780804429573");
  });

  it("returns null for invalid input", () => {
    expect(normalizeIsbn("not-an-isbn")).toBeNull();
    expect(normalizeIsbn("9780132350885")).toBeNull();
    expect(normalizeIsbn("")).toBeNull();
  });
});
