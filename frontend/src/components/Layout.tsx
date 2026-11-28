/**
 * @packageDocumentation
 * Application shell: a left sidebar on wide screens, a top bar with a drawer
 * on phones. Both hold the navigation, the shelf device status and the colour
 * theme switch. The live shelf stream is subscribed here, once for all pages.
 */
import { ChartColumn, Library, Menu, Monitor, Moon, Plus, Sun, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useHealthStatus } from '../hooks/useHealthStatus'
import { useShelf, useShelfStream } from '../hooks/useShelf'
import { useTheme, type ThemePreference } from '../lib/theme'

/** Navigation entries. */
const NAV_ITEMS = [
  { to: '/', label: 'Library', icon: Library, end: true },
  { to: '/books/new', label: 'Add book', icon: Plus, end: false },
  { to: '/stats', label: 'Statistics', icon: ChartColumn, end: false },
] as const

/** Theme options in switch order. */
const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Auto', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/**
 * Logo: a shelf with one lit slot, and the name in bold italic.
 *
 * @param props.compact - Smaller variant for the phone top bar.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={compact ? 24 : 28} height={compact ? 24 : 28} viewBox="0 0 28 28" aria-hidden="true">
        <rect x="2.5" y="4.5" width="23" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <line x1="2.5" y1="14" x2="25.5" y2="14" stroke="currentColor" strokeWidth="1.7" />
        <rect x="6" y="7.5" width="3" height="5" fill="currentColor" />
        <rect x="10.5" y="8.5" width="3" height="4" fill="currentColor" />
        <rect x="15" y="16.5" width="3" height="5" fill="currentColor" />
        <rect x="19.5" y="7" width="3.5" height="5.5" rx="0.5" className="fill-locate" />
      </svg>
      <span className={`em ${compact ? 'text-lg' : 'text-xl'} leading-none`}>Smart Bookshelf</span>
    </span>
  )
}

/** Classes of a navigation link. */
function navClasses({ isActive }: { isActive: boolean }): string {
  return `flex h-11 items-center gap-3 rounded-[var(--radius-ui)] px-3 text-[15px] transition-colors ${
    isActive ? 'bg-accent-soft font-bold text-ink' : 'text-ink hover:bg-raised'
  }`
}

/**
 * Status of the shelf device and the backend.
 */
function DeviceStatus() {
  const { data: shelf } = useShelf()
  const health = useHealthStatus()
  const apiOk = health.state === 'ok'
  const online = shelf?.device.online ?? false
  const rssi = shelf?.device.rssi
  return (
    <div className="space-y-1 rounded-[var(--radius-ui)] border border-line bg-raised p-3 text-[13px]" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">Shelf 1 · ESP32</span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-status-read' : 'bg-status-want'}`} aria-hidden="true" />
          {online ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="text-muted">
        {rssi !== undefined && online ? `Wi-Fi ${rssi} dBm · ` : ''}
        {shelf?.broker.connected ? 'MQTT connected' : 'MQTT disconnected'}
      </div>
      <div className="flex items-center gap-1.5 text-muted">
        <span className={`h-2 w-2 rounded-full ${apiOk ? 'bg-status-read' : 'bg-danger'}`} aria-hidden="true" />
        {apiOk ? 'Server and database OK' : health.state === 'loading' ? 'Checking server…' : 'Server problem'}
      </div>
    </div>
  )
}

/**
 * Auto / Light / Dark segmented switch.
 *
 * @param props.value - Current preference.
 * @param props.onChange - Called with the new preference.
 */
function ThemeSwitch({ value, onChange }: { value: ThemePreference; onChange: (value: ThemePreference) => void }) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-ui)] border border-line" role="group" aria-label="Colour theme">
      {THEME_OPTIONS.map(({ value: option, label, icon: Icon }, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`flex h-10 items-center justify-center gap-1.5 text-[13px] ${index > 0 ? 'border-l border-line' : ''} ${
            value === option ? 'bg-accent-soft font-bold text-ink' : 'text-muted hover:bg-raised'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Sidebar content shared by the desktop sidebar and the phone drawer.
 */
function SidebarContent({ theme, children }: { theme: ReturnType<typeof useTheme>; children?: ReactNode }) {
  return (
    <>
      {children}
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navClasses}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <DeviceStatus />
        <ThemeSwitch value={theme.preference} onChange={theme.setPreference} />
      </div>
    </>
  )
}

/**
 * Renders the navigation and the active page (`<Outlet />`).
 */
export function Layout() {
  const theme = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  useShelfStream()

  // Close the drawer after navigating.
  useEffect(() => setDrawerOpen(false), [location.pathname, location.search])

  const nextTheme = THEME_OPTIONS[(THEME_OPTIONS.findIndex((option) => option.value === theme.preference) + 1) % 3]!
  const CurrentThemeIcon = THEME_OPTIONS.find((option) => option.value === theme.preference)!.icon

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3.5 py-5 lg:flex">
        <SidebarContent theme={theme}>
          <NavLink to="/" className="px-2 py-1" aria-label="Smart Bookshelf – library">
            <Logo />
          </NavLink>
        </SidebarContent>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-surface px-1.5 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-ui)] hover:bg-raised"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <NavLink to="/" aria-label="Smart Bookshelf – library">
          <Logo compact />
        </NavLink>
        <button
          type="button"
          onClick={() => theme.setPreference(nextTheme.value)}
          aria-label={`Colour theme: ${THEME_OPTIONS.find((option) => option.value === theme.preference)!.label}. Switch to ${nextTheme.label}`}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius-ui)] text-muted hover:bg-raised"
        >
          <CurrentThemeIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <NavLink
          to="/books/new"
          aria-label="Add book"
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-ui)] hover:bg-raised"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </NavLink>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-3 py-4">
            <SidebarContent theme={theme}>
              <div className="flex items-center justify-between pl-2">
                <Logo compact />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-ui)] hover:bg-raised"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </SidebarContent>
          </div>
          <button type="button" aria-label="Close menu" className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-12 pt-5 sm:px-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
