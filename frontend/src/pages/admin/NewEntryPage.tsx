import { Form, Link, useActionData, useNavigation } from 'react-router'
import type { newEntryAction } from '../../adminRoutes'
import type { Category } from '../../types'
import { EntryInputs } from './EntryInputs'

export function NewEntryPage({
  categories,
  category,
}: {
  categories: Category[]
  category: string | null
}) {
  const result = useActionData<typeof newEntryAction>()
  const creating = useNavigation().state !== 'idle'

  return (
    <>
      <Link to="/admin" className="text-sm text-gray-600 hover:underline">
        ← Trámites
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Nuevo trámite</h1>
      <p className="mt-1 text-gray-600">
        Primero su texto; los requisitos y los lugares se agregan después.
      </p>

      <Form method="post" className="mt-6 max-w-2xl space-y-4">
        <EntryInputs categories={categories} category={category} />
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear trámite'}
          </button>
          {result?.error && !creating && (
            <p role="alert" className="text-sm text-red-700">
              {result.error}
            </p>
          )}
        </div>
      </Form>
    </>
  )
}
