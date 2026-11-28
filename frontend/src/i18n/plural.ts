/**
 * @packageDocumentation
 * Plural message shape shared by the translation files and the i18n core.
 */

/** A message with plural forms (CLDR categories: `one`, `few`, `many`, `other`). */
export interface PluralMessage {
  one: string
  few?: string
  many?: string
  other: string
}

/**
 * Marks a message as plural (keeps the object shape in the message type).
 *
 * @param forms - Plural forms.
 */
export function plural(forms: PluralMessage): PluralMessage {
  return forms
}
