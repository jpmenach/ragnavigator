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

export type LocationEntry = {
  role: string
  entry: EntrySummary
}

export type LocationWithEntries = Location & {
  entries: LocationEntry[]
}

export type Organization = {
  name: string
  primary_color: string
}

export type Source = {
  kind: 'entry' | 'location'
  slug: string
  section: string
  route: string
  score: number
}

// Discriminated on `type`, like the Action union in schemas.py.
export type Action =
  | { type: 'navigate'; to: string }
  | { type: 'highlight'; target: string }
  | { type: 'offer_download'; url: string; label: string }

export type AskResponse = {
  answer: string
  grounded: boolean
  sources: Source[]
  actions: Action[]
}

export type Admin = {
  username: string
}

// What the admin form saves: the entry's own fields (EntryIn in schemas.py), with its
// category by slug.
export type EntryFields = Pick<Entry, 'title' | 'summary' | 'cost' | 'duration' | 'notes'> & {
  category: string
}

// One of an entry's places as the admin saves it (EntryLocationIn): the place by slug.
export type EntryPlace = {
  location: string
  role: string
}

// What the admin's place form saves (LocationIn in schemas.py).
export type LocationFields = Omit<Location, 'slug'>

export type UnansweredQuestion = {
  id: number
  question: string
  // ISO 8601 in UTC ("…Z").
  asked_at: string
}

export type IndexedItem = {
  slug: string
  // An entry's title or a place's name.
  name: string
  up_to_date: boolean
}

export type IndexStatus = {
  entries: IndexedItem[]
  locations: IndexedItem[]
  orphans: number
}
