/**
 * @packageDocumentation
 * Edit view (`/books/:id/edit`) for the descriptive fields of a book.
 */
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { BookForm } from '../components/BookForm'
import { ErrorMessage, Spinner } from '../components/Feedback'
import { useBook, useUpdateBook } from '../hooks/useBooks'
import { bookToFormValues, formValuesToPatch, type BookFormValues } from '../lib/book-form'

/**
 * Renders the edit form; only changed fields are sent to the API.
 */
export function EditBookPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: book, error, isPending } = useBook(id)
  const update = useUpdateBook(id)

  if (isPending) return <Spinner label="Loading book…" />
  if (error || !book) return <ErrorMessage error={error} />

  const handleSubmit = (values: BookFormValues) => {
    const patch = formValuesToPatch(values, book)
    if (Object.keys(patch).length === 0) {
      navigate(`/books/${id}`)
      return
    }
    update.mutate(patch, { onSuccess: () => navigate(`/books/${id}`) })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to={`/books/${id}`} className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-bark">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the book
      </Link>
      <h1 className="font-serif text-2xl font-bold">Edit “{book.title}”</h1>
      {update.error && update.error.details.length === 0 && <ErrorMessage error={update.error} />}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <BookForm
          initialValues={bookToFormValues(book)}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
          submitting={update.isPending}
          serverErrors={update.error?.fieldErrors()}
          actions={
            <Link to={`/books/${id}`} className="text-sm text-stone-600 hover:underline">
              Cancel
            </Link>
          }
        />
      </div>
    </div>
  )
}
