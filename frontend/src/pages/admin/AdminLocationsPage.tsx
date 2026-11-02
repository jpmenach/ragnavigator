import { Link } from 'react-router'
import type { LocationWithEntries } from '../../types'

export function AdminLocationsPage({ locations }: { locations: LocationWithEntries[] }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6">
        <h1 className="text-2xl font-bold">Lugares</h1>
        <Link to="/admin/locations/new" className="text-sm text-primary hover:underline">
          + Nuevo lugar
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
        {locations.map((location) => (
          <li key={location.slug}>
            <Link
              to={`/admin/locations/${location.slug}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 px-2 py-3 hover:bg-gray-50"
            >
              <span>{location.name}</span>
              <span className="text-sm text-gray-500">{usage(location)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

// Counted by entry, not by link: a counter where one entry is requested and picked up is
// still one entry.
function usage(location: LocationWithEntries) {
  const count = new Set(location.entries.map((link) => link.entry.slug)).size
  if (count === 0) {
    return 'Sin trámites'
  }
  return count === 1 ? '1 trámite' : `${count} trámites`
}
