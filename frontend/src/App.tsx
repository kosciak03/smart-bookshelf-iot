/**
 * @packageDocumentation
 * Root component: data cache provider and router.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
