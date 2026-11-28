/**
 * @packageDocumentation
 * Minimal type-safe translations (English, Polish).
 *
 * - Messages live in `messages/en.ts` (the reference) and `messages/pl.ts`,
 *   which must have exactly the same keys (checked by TypeScript).
 * - `t('section.key', { name: 'x' })` looks a message up by its dotted path
 *   and fills `{name}` placeholders.
 * - Plural messages are objects with CLDR plural categories (`one`, `few`,
 *   `many`, `other`); `t(key, { count })` picks the right form with
 *   `Intl.PluralRules` (Polish: 1 książka, 2 książki, 5 książek).
 * - The language is detected from the browser on the first visit and then
 *   remembered in `localStorage`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './messages/en'
import { pl } from './messages/pl'
import type { PluralMessage } from './plural'

export { plural, type PluralMessage } from './plural'

/** Supported languages. */
export const LANGUAGES = ['en', 'pl'] as const
export type Language = (typeof LANGUAGES)[number]

/** Message tree: nested sections with string or plural leaves. */
export type MessageTree = { readonly [key: string]: string | PluralMessage | MessageTree }

/** Same structure as `T`, with any string values (used to type the translations). */
export type Translation<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : T[K] extends PluralMessage ? PluralMessage : Translation<T[K]>
}

/** Dotted paths of all leaves of a message tree. */
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string | PluralMessage ? K : `${K}.${Leaves<T[K]>}`
}[keyof T & string]

/** A key of the English (reference) messages. */
export type MessageKey = Leaves<typeof en>

/** Values that can fill `{placeholders}`. */
export type MessageValues = Record<string, string | number>

/** Messages per language. */
const MESSAGES: Record<Language, Translation<typeof en>> = { en, pl }

/** `localStorage` key of the chosen language. */
export const LANGUAGE_STORAGE_KEY = 'sb-language'

/** BCP 47 locale used for dates and numbers. */
export const LOCALES: Record<Language, string> = { en: 'en-GB', pl: 'pl-PL' }

/**
 * Picks the initial language: the saved choice, else the browser's language
 * (Polish for `pl*`), else English.
 */
export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'en' || saved === 'pl') return saved
  } catch {
    /* storage unavailable */
  }
  const browser = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  return browser.some((language) => language?.toLowerCase().startsWith('pl')) ? 'pl' : 'en'
}

/**
 * Looks a message up and fills its placeholders.
 *
 * @param language - Language.
 * @param key - Dotted message key.
 * @param values - Placeholder values; `count` selects the plural form.
 * @returns The translated text (the key itself when missing, which TypeScript prevents).
 */
export function translate(language: Language, key: MessageKey, values: MessageValues = {}): string {
  let node: unknown = MESSAGES[language]
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part]
  let template: string
  if (typeof node === 'string') {
    template = node
  } else if (node && typeof node === 'object' && 'other' in node) {
    const forms = node as PluralMessage
    const category = new Intl.PluralRules(LOCALES[language]).select(Number(values.count ?? 0))
    template = forms[category as keyof PluralMessage] ?? forms.other
  } else {
    return key
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    if (value === undefined) return match
    return typeof value === 'number' ? value.toLocaleString(LOCALES[language]) : value
  })
}

/** Value of the i18n context. */
export interface I18n {
  language: Language
  locale: string
  setLanguage: (language: Language) => void
  /** Translates a message. */
  t: (key: MessageKey, values?: MessageValues) => string
  /** Formats a date (`25 Nov 2026` / `25 lis 2026`), or `null` for no date. */
  formatDate: (iso: string | null, options?: Intl.DateTimeFormatOptions) => string | null
  /** Formats a number with the locale's separators. */
  formatNumber: (value: number) => string
}

/**
 * Builds the i18n helpers for a language.
 *
 * @param language - Language.
 * @param setLanguage - Language setter.
 */
function createI18n(language: Language, setLanguage: (language: Language) => void): I18n {
  const locale = LOCALES[language]
  return {
    language,
    locale,
    setLanguage,
    t: (key, values) => translate(language, key, values),
    formatDate: (iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
      iso === null ? null : new Date(iso).toLocaleDateString(locale, options),
    formatNumber: (value) => value.toLocaleString(locale),
  }
}

const I18nContext = createContext<I18n | null>(null)

/** English helpers used when no provider is mounted (isolated component tests). */
const FALLBACK = createI18n('en', () => undefined)

/**
 * Provides the current language to the app and keeps `<html lang>` in sync.
 *
 * @param props.initialLanguage - Language to start with (default: detected).
 */
export function I18nProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(() => initialLanguage ?? detectLanguage())

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
    setLanguageState(next)
  }, [])

  const value = useMemo(() => createI18n(language, setLanguage), [language, setLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Returns the translation helpers of the current language.
 */
export function useI18n(): I18n {
  return useContext(I18nContext) ?? FALLBACK
}
