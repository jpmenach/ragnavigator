import { data } from 'react-router'
import type {
  Admin,
  AskResponse,
  CategoryWithEntries,
  Entry,
  EntryFields,
  EntryPlace,
  EntrySummary,
  LocationWithEntries,
  Organization,
  Requirement,
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

// The session lives in an HttpOnly cookie the browser sends on its own; this code never
// sees the token. Asking the server is the only way to know whether someone is logged in.
export async function getCurrentAdmin(signal: AbortSignal): Promise<Admin | null> {
  const response = await fetch('/api/admin/me', { signal })
  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw new Error(`GET /api/admin/me failed with ${response.status}`)
  }
  return response.json()
}

// null for a wrong username or password: the login form shows that, it isn't an error.
export async function logIn(username: string, password: string): Promise<Admin | null> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw new Error(`POST /api/admin/login failed with ${response.status}`)
  }
  return response.json()
}

export async function logOut(): Promise<void> {
  const response = await fetch('/api/admin/logout', { method: 'POST' })
  if (!response.ok) {
    throw new Error(`POST /api/admin/logout failed with ${response.status}`)
  }
}

// How an admin write ended, for the cases the page explains instead of failing:
// 'logged-out' when the session is gone (expired, or logged out in another tab),
// 'conflict' when the server refuses it as things stand (409), 'invalid' when it rejects
// the input (422) despite the form's own checks.
export type AdminWrite = 'done' | 'logged-out' | 'conflict' | 'invalid'

async function adminWrite(method: string, path: string, body?: unknown): Promise<AdminWrite> {
  const { outcome } = await adminFetch(method, path, body)
  return outcome
}

// adminWrite, plus the response, for the writes whose body the page needs.
async function adminFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ outcome: AdminWrite; response: Response }> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401) {
    return { outcome: 'logged-out', response }
  }
  if (response.status === 409) {
    return { outcome: 'conflict', response }
  }
  if (response.status === 422) {
    return { outcome: 'invalid', response }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}`)
  }
  return { outcome: 'done', response }
}

// The new entry's slug comes from the server (made from the title), for the page to go to.
export async function createEntry(
  fields: EntryFields,
): Promise<{ outcome: AdminWrite; slug: string | null }> {
  const { outcome, response } = await adminFetch('POST', '/api/admin/entries', fields)
  const slug = outcome === 'done' ? ((await response.json()) as EntrySummary).slug : null
  return { outcome, slug }
}

export function updateEntry(slug: string, fields: EntryFields): Promise<AdminWrite> {
  return adminWrite('PUT', `/api/admin/entries/${slug}`, fields)
}

// The whole list, in order: the server replaces what the entry had.
export function replaceRequirements(
  slug: string,
  requirements: Requirement[],
): Promise<AdminWrite> {
  return adminWrite('PUT', `/api/admin/entries/${slug}/requirements`, requirements)
}

// Also the whole list, in step order. Places are picked by slug, not created here.
export function replaceLocations(slug: string, places: EntryPlace[]): Promise<AdminWrite> {
  return adminWrite('PUT', `/api/admin/entries/${slug}/locations`, places)
}

export function deleteEntry(slug: string): Promise<AdminWrite> {
  return adminWrite('DELETE', `/api/admin/entries/${slug}`)
}

export function createCategory(name: string): Promise<AdminWrite> {
  return adminWrite('POST', '/api/admin/categories', { name })
}

export function renameCategory(slug: string, name: string): Promise<AdminWrite> {
  return adminWrite('PUT', `/api/admin/categories/${slug}`, { name })
}

export function deleteCategory(slug: string): Promise<AdminWrite> {
  return adminWrite('DELETE', `/api/admin/categories/${slug}`)
}
