import { Link } from 'react-router'
import { LocationDetails } from '../components/LocationDetails'
import type { EntrySummary, LocationEntry, LocationWithEntries } from '../types'

// Each location's id is its slug, so /locations#caja-central lands on that card (the
// assistant navigates and highlights it).
export function LocationsPage({ locations }: { locations: LocationWithEntries[] }) {
  return (
    <>
      <h1 className="text-3xl font-bold">Lugares y horarios</h1>
      <p className="mt-2 text-lg text-gray-600">
        Dónde queda cada oficina, cuándo atiende y qué trámites se hacen ahí.
      </p>

      <ul className="mt-8 space-y-4">
        {locations.map((location) => (
          <li
            key={location.slug}
            id={location.slug}
            className="rounded-lg border border-gray-200 p-4"
          >
            <h2 className="text-xl font-semibold">{location.name}</h2>
            <LocationDetails location={location} />

            <dl className="mt-4 space-y-3">
              {groupByRole(location.entries).map(([role, entries]) => (
                <div key={role}>
                  <dt className="text-sm font-medium text-primary">{role}</dt>
                  <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {entries.map((entry) => (
                      <Link
                        key={entry.slug}
                        to={`/entries/${entry.slug}`}
                        className="hover:text-primary hover:underline"
                      >
                        {entry.title}
                      </Link>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}

// Roles in the order they first appear; a Map keeps insertion order.
function groupByRole(links: LocationEntry[]): [string, EntrySummary[]][] {
  const groups = new Map<string, EntrySummary[]>()
  for (const { role, entry } of links) {
    groups.set(role, [...(groups.get(role) ?? []), entry])
  }
  return [...groups]
}

export function LocationsError() {
  return (
    <p className="text-gray-600">
      No pudimos cargar los lugares. Intenta de nuevo en unos minutos.
    </p>
  )
}
