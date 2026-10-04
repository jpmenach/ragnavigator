import { data } from 'react-router'
import type {
  AskResponse,
  CategoryWithEntries,
  Entry,
  LocationWithEntries,
  Organization,
} from './types'

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

export async function getCategories(signal: AbortSignal): Promise<CategoryWithEntries[]> {
  const response = await fetch('/api/categories', { signal })
  if (!response.ok) {
    throw new Error(`GET /api/categories failed with ${response.status}`)
  }
  return response.json()
}

export async function getLocations(signal: AbortSignal): Promise<LocationWithEntries[]> {
  const response = await fetch('/api/locations', { signal })
  if (!response.ok) {
    throw new Error(`GET /api/locations failed with ${response.status}`)
  }
  return response.json()
}

export async function getOrganization(signal: AbortSignal): Promise<Organization> {
  const response = await fetch('/api/organization', { signal })
  if (!response.ok) {
    throw new Error(`GET /api/organization failed with ${response.status}`)
  }
  return response.json()
}

export async function askQuestion(question: string): Promise<AskResponse> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!response.ok) {
    throw new Error(`POST /api/ask failed with ${response.status}`)
  }
  return response.json()
}
