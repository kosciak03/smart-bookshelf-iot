/**
 * @packageDocumentation
 * Application shell: top navigation bar and page container.
 */
import { BookPlus, Library } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { HealthIndicator } from './HealthIndicator'

/**
 * Classes of a navigation link.
 *
 * @param state - Link state provided by `NavLink`.
 */
function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return `inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors ${
    isActive ? 'bg-white/15 text-white' : 'text-stone-200 hover:bg-white/10 hover:text-white'
  }`
}

/**
 * Renders the header and the active page (`<Outlet />`).
 */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-bark text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="font-serif text-xl font-bold tracking-tight">
            smart<span className="font-normal">bookshelf</span>
          </NavLink>
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={navLinkClasses}>
              <Library className="h-4 w-4" aria-hidden="true" />
              My books
            </NavLink>
            <NavLink to="/books/new" className={navLinkClasses}>
              <BookPlus className="h-4 w-4" aria-hidden="true" />
              Add book
            </NavLink>
          </nav>
          <HealthIndicator variant="compact" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-stone-300 py-4 text-center text-xs text-stone-500">
        Smart Bookshelf IoT · engineering thesis project
      </footer>
    </div>
  )
}
