import { isRouteErrorResponse, useRouteError } from 'react-router'
import type { Entry, Location } from '../types'

// The section ids are part of the page's contract: the assistant will scroll to and
// highlight them (#requisitos, #donde-y-cuando), so they shouldn't change casually.
export function EntryPage({ entry }: { entry: Entry }) {
  return (
    <article>
      <p>{entry.category.name}</p>
      <h1>{entry.title}</h1>
      <p>{entry.summary}</p>

      <dl>
        {entry.cost && (
          <>
            <dt>Costo</dt>
            <dd>{entry.cost}</dd>
          </>
        )}
        {entry.duration && (
          <>
            <dt>Duración</dt>
            <dd>{entry.duration}</dd>
          </>
        )}
      </dl>

      <section id="requisitos">
        <h2>Requisitos</h2>
        <ol>
          {entry.requirements.map((requirement) => (
            <li key={requirement.name}>
              {requirement.name}
              {requirement.description && <p>{requirement.description}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section id="donde-y-cuando">
        <h2>Dónde y cuándo</h2>
        <ol>
          {entry.locations.map(({ role, location }) => (
            <li key={`${role}-${location.slug}`}>
              <strong>{role}:</strong> {location.name}
              <LocationDetails location={location} />
            </li>
          ))}
        </ol>
      </section>

      {entry.notes && (
        <section id="notas">
          <h2>Notas</h2>
          <p>{entry.notes}</p>
        </section>
      )}
    </article>
  )
}

function LocationDetails({ location }: { location: Location }) {
  const place = [location.building, location.floor].filter(Boolean).join(', ')
  return (
    <>
      {place && <p>{place}</p>}
      {location.directions && <p>{location.directions}</p>}
      {location.hours && <p>{location.hours}</p>}
    </>
  )
}

export function EntryError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <p>No encontramos este trámite.</p>
  }
  return <p>No pudimos cargar este trámite. Intenta de nuevo en unos minutos.</p>
}
