/**
 * @packageDocumentation
 * Colour theme: Auto (follows the operating system), Light or Dark. The choice
 * is stored in `localStorage` and applied as the `dark` class on `<html>`.
 * `index.html` applies it once before React starts, to avoid a light flash.
 */
import { useCallback, useEffect, useState } from 'react'

/** User's theme preference. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** `localStorage` key (also read by the inline script in `index.html`). */
export const THEME_STORAGE_KEY = 'sb-theme'

/** Media query of the operating system's dark mode. */
const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Reads the saved preference.
 *
 * @returns The saved preference, `system` when none or storage is unavailable.
 */
export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Resolves a preference to the theme to show.
 *
 * @param preference - User's preference.
 * @returns `dark` or `light`.
 */
export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Applies a preference to the document.
 *
 * @param preference - User's preference.
 */
export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(preference) === 'dark')
}

/**
 * Theme state for the switch in the navigation. With `system`, the page
 * follows changes of the operating system's setting while it is open.
 *
 * @returns The preference, the resolved theme and a setter.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference)
  const [resolved, setResolved] = useState(() => resolveTheme(preference))

  useEffect(() => {
    applyTheme(preference)
    setResolved(resolveTheme(preference))
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      applyTheme('system')
      setResolved(resolveTheme('system'))
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
    setPreferenceState(next)
  }, [])

  return { preference, resolved, setPreference }
}
