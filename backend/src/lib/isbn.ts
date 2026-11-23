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
  const sum = [...isbn.slice(0, 12)].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(isbn[12]);
}
