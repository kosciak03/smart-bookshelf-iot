/**
 * @packageDocumentation
 * Vitest setup: Testing Library matchers and DOM cleanup after each test.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
