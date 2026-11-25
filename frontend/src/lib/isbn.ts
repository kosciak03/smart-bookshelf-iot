/**
 * @packageDocumentation
 * ISBN helpers for barcode scanning.
 *
 * The barcode on a book's back cover is an EAN-13 code that *is* the ISBN-13:
 * it starts with the "Bookland" prefix 978 or 979. Other EAN-13 codes (e.g. a
 * price sticker or a magazine ISSN, prefix 977) must not be taken for an ISBN.
 */

/**
 * Checks the ISBN-13 / EAN-13 check digit.
 *
 * @param digits - Exactly 13 digits.
 * @returns `true` when the check digit matches.
 */
export function hasValidEan13Checksum(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false
  const sum = [...digits.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10 === Number(digits[12])
}

/**
 * Extracts an ISBN-13 from a scanned barcode text.
 *
 * @param code - Decoded barcode text.
 * @returns The ISBN-13, or `null` when the code is not a book barcode.
 */
export function isbnFromBarcode(code: string): string | null {
  const digits = code.replace(/\D/g, '')
  return /^97[89]\d{10}$/.test(digits) && hasValidEan13Checksum(digits) ? digits : null
}
