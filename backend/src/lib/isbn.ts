/**
 * @packageDocumentation
 * ISBN helpers. Books are stored with a normalized ISBN-13 (digits only).
 */

/**
 * Checks whether a string is a valid ISBN-13 (13 digits with a correct
 * modulo-10 checksum, weights alternating 1 and 3).
 *
 * @param isbn - Candidate ISBN, digits only.
 * @returns `true` when the value is a valid ISBN-13.
 */
export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  return isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];
}

/**
 * Checks whether a string is a valid ISBN-10 (9 digits followed by a digit or
 * `X`, modulo-11 checksum with weights 10..1).
 *
 * @param isbn - Candidate ISBN, digits (and optional trailing `X`) only.
 * @returns `true` when the value is a valid ISBN-10.
 */
export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, char, index) => acc + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
  return sum % 11 === 0;
}

/**
 * Normalizes user input to an ISBN-13.
 *
 * Accepts hyphens and spaces (e.g. `978-0-13-235088-4`) and converts valid
 * ISBN-10 values to their ISBN-13 (`978` prefix) equivalent.
 *
 * @param input - Raw ISBN as typed or scanned by the user.
 * @returns The normalized ISBN-13, or `null` when the input is not a valid ISBN.
 */
export function normalizeIsbn(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "").toUpperCase();
  if (isValidIsbn13(compact)) return compact;
  if (isValidIsbn10(compact)) {
    const body = `978${compact.slice(0, 9)}`;
    return body + isbn13CheckDigit(body);
  }
  return null;
}

/**
 * Computes the ISBN-13 check digit for the first 12 digits.
 *
 * @param first12 - The first 12 digits of an ISBN-13.
 * @returns The check digit as a single-character string.
 */
function isbn13CheckDigit(first12: string): string {
  const sum = [...first12].reduce((acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}
