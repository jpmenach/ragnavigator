import { Form, Link, useActionData, useNavigation } from 'react-router'
import type { saveEntryAction } from '../../adminRoutes'
import type { Entry } from '../../types'

const INPUT =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none'

// The entry's own text. Requirements and places are lists with their own editing, later.
export function EntryFormPage({ entry }: { entry: Entry }) {
  const result = useActionData<typeof saveEntryAction>()
  const saving = useNavigation().state !== 'idle'

  return (
    <>
      <Link to="/admin" className="text-sm text-gray-600 hover:underline">
        ← Trámites
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6">
        <h1 className="text-2xl font-bold">{entry.title}</h1>
        <Link to={`/entries/${entry.slug}`} className="text-sm text-primary hover:underline">
          Ver en el sitio
        </Link>
      </div>

      {/* Keyed by slug: moving to another entry starts a fresh form, not one holding the
          previous entry's edits. */}
      <Form key={entry.slug} method="post" className="mt-6 max-w-2xl space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Título</span>
          <input
            name="title"
            defaultValue={entry.title}
            required
            maxLength={200}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Resumen</span>
          <textarea
            name="summary"
            defaultValue={entry.summary}
            required
            maxLength={500}
            rows={2}
            className={INPUT}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Costo</span>
            <input name="cost" defaultValue={entry.cost ?? ''} maxLength={200} className={INPUT} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Duración</span>
            <input
              name="duration"
              defaultValue={entry.duration ?? ''}
              maxLength={200}
              className={INPUT}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Observaciones</span>
          <textarea
            name="notes"
            defaultValue={entry.notes ?? ''}
            maxLength={5000}
            rows={4}
            className={INPUT}
          />
        </label>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {result && !saving && (
            <p role="status" className="text-sm text-gray-600">
              {result.saved ? 'Guardado.' : 'No se pudo guardar: revisa los campos.'}
            </p>
          )}
        </div>
      </Form>
    </>
  )
}
