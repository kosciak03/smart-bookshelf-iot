/**
 * @packageDocumentation
 * Root component: translations, data cache provider and router.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { I18nProvider } from './i18n/core'
import { routes } from './router'

/** Shared query cache (data is considered fresh for 30 s). */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
  },
})

/** Browser router created once for the whole application. */
const router = createBrowserRouter(routes)

/**
 * Renders the application.
 */
export default function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>
  )
}
