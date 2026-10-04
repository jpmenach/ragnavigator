// Mirrors the response schemas in src/ragnavigator/schemas.py.

export type Category = {
  name: string
  slug: string
}

export type Requirement = {
  name: string
  description: string | null
}

export type Location = {
  name: string
  slug: string
  building: string | null
  floor: string | null
  directions: string | null
  hours: string | null
}

export type EntryLocation = {
  role: string
  location: Location
}

export type Entry = {
  title: string
  slug: string
  summary: string
  cost: string | null
  duration: string | null
  notes: string | null
  category: Category
  requirements: Requirement[]
  locations: EntryLocation[]
}

export type EntrySummary = {
  title: string
  slug: string
  summary: string
}

export type CategoryWithEntries = Category & {
  entries: EntrySummary[]
}
