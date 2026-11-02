import { Form, Link, useActionData, useNavigation } from 'react-router'
import type { newLocationAction } from '../../adminRoutes'
import { LocationInputs } from './LocationInputs'

export function NewLocationPage() {
  const result = useActionData<typeof newLocationAction>()
  const creating = useNavigation().state !== 'idle'

  return (
    <>
      <Link to="/admin/locations" className="text-sm text-gray-600 hover:underline">
        ← Lugares
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Nuevo lugar</h1>

      <Form method="post" className="mt-6 max-w-2xl space-y-4">
        <LocationInputs />
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear lugar'}
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
