import { useState } from 'react'
import { useFetcher } from 'react-router'
import type { requirementsAction } from '../../adminRoutes'
import type { Requirement } from '../../types'

const INPUT =
  'block w-full rounded-lg border border-gray-300 px-3 py-1.5 focus:border-primary focus:outline-none'
const SMALL_BUTTON =
  'text-sm text-gray-600 hover:underline disabled:opacity-30 disabled:no-underline'

// A row on screen. `key` tells React which row is which while they move, so a moved row
// keeps its inputs instead of taking the ones of the row that was there before.
type Row = Requirement & { key: string }

function toRow(requirement: Requirement): Row {
  return { ...requirement, key: crypto.randomUUID() }
}

// The entry's requirements, edited as a list and saved all at once: the server replaces
// the whole list, so adding, removing and reordering are all just "save what's on screen".
export function RequirementsEditor({
  slug,
  requirements,
}: {
  slug: string
  requirements: Requirement[]
}) {
  const fetcher = useFetcher<typeof requirementsAction>()
  const [rows, setRows] = useState(() => requirements.map(toRow))
  const saving = fetcher.state !== 'idle'

  function update(index: number, changes: Partial<Requirement>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  function move(index: number, by: -1 | 1) {
    const moved = [...rows]
    ;[moved[index], moved[index + by]] = [moved[index + by], moved[index]]
    setRows(moved)
  }

  return (
    <section className="mt-12 max-w-2xl border-t border-gray-200 pt-6">
      <h2 className="text-lg font-semibold">Requisitos</h2>
      <fetcher.Form method="post" action={`/admin/entries/${slug}/requirements`}>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Sin requisitos.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="flex gap-3 rounded-lg border border-gray-200 p-3">
                <span className="pt-1.5 text-sm text-gray-500">{index + 1}.</span>
                <div className="flex-1 space-y-2">
                  <input
                    name="name"
                    value={row.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    aria-label={`Requisito ${index + 1}`}
                    placeholder="Requisito"
                    required
                    maxLength={200}
                    className={INPUT}
                  />
                  <input
                    name="description"
                    value={row.description ?? ''}
                    onChange={(event) => update(index, { description: event.target.value })}
                    aria-label={`Detalle del requisito ${index + 1}`}
                    placeholder="Detalle (opcional)"
                    maxLength={1000}
                    className={`${INPUT} text-sm`}
                  />
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Subir el requisito ${index + 1}`}
                      className={SMALL_BUTTON}
                    >
                      ↑ Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                      aria-label={`Bajar el requisito ${index + 1}`}
                      className={SMALL_BUTTON}
                    >
                      ↓ Bajar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      aria-label={`Quitar el requisito ${index + 1}`}
                      className="text-sm text-red-700 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          onClick={() => setRows([...rows, toRow({ name: '', description: null })])}
          className="mt-3 text-sm text-primary hover:underline"
        >
          + Agregar requisito
        </button>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar requisitos'}
          </button>
          {fetcher.data && !saving && (
            <p role="status" className="text-sm text-gray-600">
              {fetcher.data.saved
                ? 'Requisitos guardados.'
                : 'No se pudo guardar: revisa los campos.'}
            </p>
          )}
        </div>
      </fetcher.Form>
    </section>
  )
}
