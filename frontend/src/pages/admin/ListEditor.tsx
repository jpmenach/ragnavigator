import { useState } from 'react'
import type { ReactNode } from 'react'
import { useFetcher } from 'react-router'

const SMALL_BUTTON =
  'text-sm text-gray-600 hover:underline disabled:opacity-30 disabled:no-underline'

// What an editor's list says about itself, in the words its buttons and messages use.
type Texts = {
  title: string
  // Singular, for the buttons' labels: "Subir el requisito 2".
  noun: string
  empty: string
  saveLabel: string
  saved: string
}

// A row on screen. `key` tells React which row is which while they move, so a moved row
// keeps its inputs instead of taking the ones of the row that was there before.
type Row<T> = { item: T; key: string }

function toRow<T>(item: T): Row<T> {
  return { item, key: crypto.randomUUID() }
}

// One of an entry's lists (requirements, places), edited on screen and saved all at once:
// the server replaces the whole list, so adding, removing and reordering are all just
// "save what's on screen". Each row's inputs are posted in screen order, which is the
// list's order; `fields` draws them.
export function ListEditor<T>({
  action,
  initial,
  blank,
  texts,
  fields,
}: {
  action: string
  initial: T[]
  blank: T
  texts: Texts
  fields: (item: T, number: number, update: (changes: Partial<T>) => void) => ReactNode
}) {
  // Both list actions answer { saved }.
  const fetcher = useFetcher<{ saved: boolean }>()
  const [rows, setRows] = useState(() => initial.map(toRow))
  const saving = fetcher.state !== 'idle'

  function update(index: number, changes: Partial<T>) {
    setRows(
      rows.map((row, i) => (i === index ? { ...row, item: { ...row.item, ...changes } } : row)),
    )
  }

  function move(index: number, by: -1 | 1) {
    const moved = [...rows]
    ;[moved[index], moved[index + by]] = [moved[index + by], moved[index]]
    setRows(moved)
  }

  return (
    <section className="mt-12 max-w-2xl border-t border-gray-200 pt-6">
      <h2 className="text-lg font-semibold">{texts.title}</h2>
      <fetcher.Form method="post" action={action}>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{texts.empty}</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="flex gap-3 rounded-lg border border-gray-200 p-3">
                <span className="pt-1.5 text-sm text-gray-500">{index + 1}.</span>
                <div className="flex-1 space-y-2">
                  {fields(row.item, index + 1, (changes) => update(index, changes))}
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Subir el ${texts.noun} ${index + 1}`}
                      className={SMALL_BUTTON}
                    >
                      ↑ Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                      aria-label={`Bajar el ${texts.noun} ${index + 1}`}
                      className={SMALL_BUTTON}
                    >
                      ↓ Bajar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      aria-label={`Quitar el ${texts.noun} ${index + 1}`}
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
          onClick={() => setRows([...rows, toRow(blank)])}
          className="mt-3 text-sm text-primary hover:underline"
        >
          + Agregar {texts.noun}
        </button>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            {saving ? 'Guardando…' : texts.saveLabel}
          </button>
          {fetcher.data && !saving && (
            <p role="status" className="text-sm text-gray-600">
              {fetcher.data.saved ? texts.saved : 'No se pudo guardar: revisa los campos.'}
            </p>
          )}
        </div>
      </fetcher.Form>
    </section>
  )
}
