import { isRouteErrorResponse, useRouteError } from 'react-router'
import type { Entry, Location } from '../types'

// The section ids are part of the page's contract: the assistant will scroll to and
// highlight them (#requisitos, #donde-y-cuando), so they shouldn't change casually.
export function EntryPage({ entry }: { entry: Entry }) {
  return (
    <article>
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        {entry.category.name}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{entry.title}</h1>
      <p className="mt-2 text-lg text-gray-600">{entry.summary}</p>

      {(entry.cost || entry.duration) && (
        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-primary/5 p-4">
          {entry.cost && (
            <div>
              <dt className="text-sm text-gray-500">Costo</dt>
              <dd className="font-semibold">{entry.cost}</dd>
            </div>
          )}
          {entry.duration && (
            <div>
              <dt className="text-sm text-gray-500">Duración</dt>
              <dd className="font-semibold">{entry.duration}</dd>
            </div>
          )}
        </dl>
      )}

      <section id="requisitos" className="mt-8">
        <h2 className="text-xl font-semibold">Requisitos</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 marker:text-gray-400">
          {entry.requirements.map((requirement) => (
            <li key={requirement.name}>
              {requirement.name}
              {requirement.description && (
                <p className="text-sm text-gray-600">{requirement.description}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section id="donde-y-cuando" className="mt-8">
        <h2 className="text-xl font-semibold">Dónde y cuándo</h2>
        <ol className="mt-3 space-y-3">
          {entry.locations.map(({ role, location }) => (
            <li key={`${role}-${location.slug}`} className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-primary">{role}</p>
              <p className="font-semibold">{location.name}</p>
              <LocationDetails location={location} />
            </li>
          ))}
        </ol>
      </section>

      {entry.notes && (
        <section id="notas" className="mt-8">
          <h2 className="text-xl font-semibold">Notas</h2>
          <p className="mt-3 text-gray-700">{entry.notes}</p>
        </section>
      )}
    </article>
  )
}

function LocationDetails({ location }: { location: Location }) {
  const place = [location.building, location.floor].filter(Boolean).join(', ')
  return (
    <div className="mt-1 space-y-0.5 text-sm text-gray-600">
      {place && <p>{place}</p>}
      {location.directions && <p>{location.directions}</p>}
      {location.hours && <p>{location.hours}</p>}
    </div>
  )
}

export function EntryError() {
  const error = useRouteError()
  const message =
    isRouteErrorResponse(error) && error.status === 404
      ? 'No encontramos este trámite.'
      : 'No pudimos cargar este trámite. Intenta de nuevo en unos minutos.'
  return <p className="text-gray-600">{message}</p>
}
