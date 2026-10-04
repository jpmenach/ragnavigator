import { data } from 'react-router'
import type { Entry } from './types'

export async function getEntry(slug: string, signal: AbortSignal): Promise<Entry> {
  const response = await fetch(`/api/entries/${slug}`, { signal })
  if (response.status === 404) {
    // Thrown as a route error response, so the error boundary can tell "no such entry"
    // apart from the API being down.
    throw data('Entry not found', { status: 404 })
  }
  if (!response.ok) {
    throw new Error(`GET /api/entries/${slug} failed with ${response.status}`)
  }
  return response.json()
}
