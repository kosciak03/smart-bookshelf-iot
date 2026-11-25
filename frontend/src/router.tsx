/**
 * @packageDocumentation
 * Route table of the web application.
 */
import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { AddBookPage } from './pages/AddBookPage'
import { BookDetailsPage } from './pages/BookDetailsPage'
import { EditBookPage } from './pages/EditBookPage'
import { LibraryPage } from './pages/LibraryPage'
import { NotFoundPage } from './pages/NotFoundPage'

/** Application routes (shared by the browser router and the tests). */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'books/new', element: <AddBookPage /> },
      { path: 'books/:id', element: <BookDetailsPage /> },
      { path: 'books/:id/edit', element: <EditBookPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
