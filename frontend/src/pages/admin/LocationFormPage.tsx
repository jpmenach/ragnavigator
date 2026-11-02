import {
  Form,
  Link,
  isRouteErrorResponse,
  useActionData,
  useNavigation,
  useRouteError,
} from 'react-router'
import type { locationAction } from '../../adminRoutes'
import type { LocationWithEntries } from '../../types'
import { LocationInputs } from './LocationInputs'

export function LocationFormPage({ location }: { location: LocationWithEntries }) {
  const result = useActionData<typeof locationAction>()
  const navigation = useNavigation()
  const saving = navigation.state !== 'idle' && navigation.formData?.get('intent') !== 'delete'
  // One entry can use the place twice (request and pick up there): listed once.
  const entries = [
    ...new Map(location.entries.map((link) => [link.entry.slug, link.entry])).values(),
  ]

  return (
    <>
      <Link to="/admin/locations" className="text-sm text-gray-600 hover:underline">
        ← Lugares
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6">
        <h1 className="text-2xl font-bold">{location.name}</h1>
        <Link
          to={`/locations#${location.slug}`}
          className="text-sm text-primary hover:underline"
        >
          Ver en el sitio
        </Link>
      </div>

      {/* Keyed by slug, like the entry form: another place starts a fresh form. */}
      <Form key={location.slug} method="post" className="mt-6 max-w-2xl space-y-4">
        <LocationInputs location={location} />
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {result && !result.error && !saving && (
            <p role="status" className="text-sm text-gray-600">
              {result.saved ? 'Guardado.' : 'No se pudo guardar: revisa los campos.'}
            </p>
          )}
        </div>
      </Form>

      <section className="mt-12 max-w-2xl border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">Trámites que lo usan</h2>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Ninguno todavía.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500">
              Al guardar, también se actualiza lo que estos trámites dicen del lugar.
            </p>
            <ul className="mt-2 list-disc pl-5">
              {entries.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    to={`/admin/entries/${entry.slug}`}
                    className="text-primary hover:underline"
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Only unused places: the server refuses the rest, so don't offer it. */}
      {entries.length === 0 && (
        <Form
          method="post"
          onSubmit={(event) => {
            if (!confirm(`¿Eliminar «${location.name}»?`)) {
              event.preventDefault()
            }
          }}
          className="mt-12 max-w-2xl border-t border-gray-200 pt-6"
        >
          <button
            type="submit"
            name="intent"
            value="delete"
            className="text-sm text-red-700 hover:underline"
          >
            Eliminar lugar
          </button>
        </Form>
      )}
      {result?.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {result.error}
        </p>
      )}
    </>
  )
}

export function LocationError() {
  const error = useRouteError()
  const message =
    isRouteErrorResponse(error) && error.status === 404
      ? 'No encontramos este lugar.'
      : 'No pudimos cargar este lugar. Intenta de nuevo en unos minutos.'
  return <p className="text-gray-600">{message}</p>
}
