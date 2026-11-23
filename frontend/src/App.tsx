/**
 * @packageDocumentation
 * Root component of the Smart Bookshelf web application.
 */
import { HealthIndicator } from './components/HealthIndicator'

/**
 * Application shell. For now it only displays the backend connection status.
 */
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-stone-200 p-6 text-center">
        <h1 className="text-2xl font-bold text-amber-900">Smart Bookshelf</h1>
        <p className="mt-2 mb-4 text-sm text-stone-600">Library manager for the smart bookshelf IoT system.</p>
        <HealthIndicator />
      </div>
    </div>
  )
}
