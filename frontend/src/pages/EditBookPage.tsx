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
      <Link to={`/books/${id}`} className="inline-flex items-center gap-1 text-[15px] text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the book
      </Link>
      <h1 className="em text-3xl">Edit “{book.title}”</h1>
      {update.error && update.error.details.length === 0 && <ErrorMessage error={update.error} />}
      <div className="rounded-[var(--radius-ui)] border border-line bg-surface p-6 ">
        <BookForm
          initialValues={bookToFormValues(book)}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
          submitting={update.isPending}
          serverErrors={update.error?.fieldErrors()}
          actions={
            <Link to={`/books/${id}`} className="text-[15px] text-muted hover:underline">
              Cancel
            </Link>
          }
        />
      </div>
    </div>
  )
}
