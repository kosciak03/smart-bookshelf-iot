/**
 * @packageDocumentation
 * Form for entering or editing book details.
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import { BOOK_STATUSES } from '../api/books'
import { validateBookForm, type BookFormField, type BookFormValues } from '../lib/book-form'
import { STATUS_LABELS } from '../lib/labels'

/** Props of {@link BookForm}. */
export interface BookFormProps {
  initialValues: BookFormValues
  /** Called with valid values. */
  onSubmit: (values: BookFormValues) => void
  submitLabel: string
  submitting?: boolean
  /** Field errors returned by the server (keys are API field names). */
  serverErrors?: Record<string, string>
  /** Show the reading status select (only when creating a book). */
  showStatus?: boolean
  /** Extra buttons next to the submit button. */
  actions?: ReactNode
}

/** Classes of text inputs. */
const INPUT_CLASSES =
  'mt-1 w-full rounded-[var(--radius-ui)] border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-danger'

/**
 * Renders the book form with client-side validation and server error display.
 */
export function BookForm({
  initialValues,
  onSubmit,
  submitLabel,
  submitting = false,
  serverErrors = {},
  showStatus = false,
  actions,
}: BookFormProps) {
  const [values, setValues] = useState(initialValues)
  const [clientErrors, setClientErrors] = useState<Partial<Record<BookFormField, string>>>({})

  const set = (field: BookFormField) => (value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }))
    setClientErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const errors = validateBookForm(values)
    setClientErrors(errors)
    if (Object.keys(errors).length === 0) onSubmit(values)
  }

  /** Renders a labelled input with its error message. */
  const field = (name: BookFormField, label: string, options: { required?: boolean; type?: string; placeholder?: string; inputMode?: 'numeric' } = {}) => {
    const error = clientErrors[name] ?? serverErrors[name]
    const id = `book-${name}`
    return (
      <div>
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          {label}
          {options.required && <span className="text-danger"> *</span>}
        </label>
        <input
          id={id}
          type={options.type ?? 'text'}
          inputMode={options.inputMode}
          value={values[name]}
          placeholder={options.placeholder}
          onChange={(event) => set(name)(event.target.value)}
          aria-invalid={error !== undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={INPUT_CLASSES}
        />
        {error && (
          <p id={`${id}-error`} className="mt-1 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  const descriptionError = clientErrors.description ?? serverErrors.description

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('title', 'Title', { required: true })}
        {field('author', 'Author(s)', { required: true, placeholder: 'e.g. Stanisław Lem' })}
        {field('isbn', 'ISBN', { placeholder: '978-…' })}
        {field('publisher', 'Publisher')}
        {field('publishedYear', 'Publication year', { inputMode: 'numeric' })}
        {field('pageCount', 'Number of pages', { inputMode: 'numeric' })}
        {field('coverUrl', 'Cover image URL', { type: 'url', placeholder: 'https://…' })}
        {field('tags', 'Tags', { placeholder: 'fantasy, polish, favourites' })}
      </div>

      <div>
        <label htmlFor="book-description" className="text-[15px] font-medium text-ink">
          Description
        </label>
        <textarea
          id="book-description"
          rows={4}
          value={values.description}
          onChange={(event) => set('description')(event.target.value)}
          className={INPUT_CLASSES}
        />
        {descriptionError && <p className="mt-1 text-[13px] text-danger">{descriptionError}</p>}
      </div>

      {showStatus && (
        <div>
          <label htmlFor="book-status" className="text-[15px] font-medium text-ink">
            Shelf
          </label>
          <select
            id="book-status"
            value={values.status}
            onChange={(event) => set('status')(event.target.value)}
            className={`${INPUT_CLASSES} sm:w-64`}
          >
            {BOOK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-[var(--radius-ui)] bg-accent px-5 py-2 text-[15px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {actions}
      </div>
    </form>
  )
}
