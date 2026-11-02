import { Form, Link, useActionData, useNavigation } from 'react-router'
import type { entryAction } from '../../adminRoutes'
import type { Category, Entry } from '../../types'
import { EntryInputs } from './EntryInputs'

// The entry's own fields. Requirements and places are lists with their own editing, later.
export function EntryFormPage({ entry, categories }: { entry: Entry; categories: Category[] }) {
  const result = useActionData<typeof entryAction>()
  const navigation = useNavigation()
  const saving = navigation.state !== 'idle' && navigation.formData?.get('intent') !== 'delete'

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
        <EntryInputs entry={entry} categories={categories} category={entry.category.slug} />
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

      {/* A separate form, away from "Guardar": deleting can't be undone. */}
      <Form
        method="post"
        onSubmit={(event) => {
          if (!confirm(`¿Eliminar «${entry.title}»? Se borran también sus requisitos.`)) {
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
          Eliminar trámite
        </button>
      </Form>
    </>
  )
}
