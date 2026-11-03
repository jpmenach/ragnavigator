import { Form, Link, useNavigation } from 'react-router'
import type { IndexStatus, IndexedItem } from '../../types'

export function IndexStatusPage({ status }: { status: IndexStatus }) {
  // formData lasts through the sync and the reload of the status after it.
  const syncing = useNavigation().formData !== undefined
  const staleEntries = status.entries.filter((entry) => !entry.up_to_date)
  const staleLocations = status.locations.filter((location) => !location.up_to_date)
  const upToDate = staleEntries.length === 0 && staleLocations.length === 0 && !status.orphans

  return (
    <>
      <h1 className="text-2xl font-bold">Índice</h1>
      <p className="mt-1 max-w-2xl text-gray-600">
        Lo que el asistente sabe, comparado con el catálogo. Guardar desde aquí lo mantiene
        al día; esto muestra lo que se quedó atrás (un cambio que no llegó al índice, o la
        base de datos editada a mano).
      </p>

      {upToDate ? (
        <p role="status" className="mt-6 font-medium text-green-800">
          Todo al día: {count(status.entries.length, 'trámite', 'trámites')} y{' '}
          {count(status.locations.length, 'lugar', 'lugares')}.
        </p>
      ) : (
        <>
          <StaleList
            title="Trámites desactualizados"
            items={staleEntries}
            href={(slug) => `/admin/entries/${slug}`}
          />
          <StaleList
            title="Lugares desactualizados"
            items={staleLocations}
            href={(slug) => `/admin/locations/${slug}`}
          />
          {status.orphans > 0 && (
            <p className="mt-6">
              {status.orphans === 1
                ? '1 documento de algo que ya se eliminó.'
                : `${status.orphans} documentos de cosas que ya se eliminaron.`}
            </p>
          )}
          <Form method="post" className="mt-6">
            <button
              type="submit"
              disabled={syncing}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
            >
              {syncing ? 'Reindexando…' : 'Reindexar lo desactualizado'}
            </button>
          </Form>
        </>
      )}
    </>
  )
}

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function StaleList({
  title,
  items,
  href,
}: {
  title: string
  items: IndexedItem[]
  href: (slug: string) => string
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <section className="mt-6">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-disc pl-5">
        {items.map((item) => (
          <li key={item.slug}>
            <Link to={href(item.slug)} className="text-primary hover:underline">
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
