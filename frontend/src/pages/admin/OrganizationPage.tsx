import { useState } from 'react'
import { Form, useActionData, useNavigation } from 'react-router'
import type { organizationAction } from '../../adminRoutes'
import { textColorOn } from '../../theme'
import type { Organization } from '../../types'

const INPUT =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none'

// Controlled, unlike the other forms: the preview follows the inputs as they change.
export function OrganizationPage({ organization }: { organization: Organization }) {
  const result = useActionData<typeof organizationAction>()
  const saving = useNavigation().state !== 'idle'
  const [name, setName] = useState(organization.name)
  const [color, setColor] = useState(organization.primary_color)

  return (
    <>
      <h1 className="text-2xl font-bold">Organización</h1>
      <p className="mt-1 text-gray-600">El nombre y el color que muestra el sitio.</p>

      <Form method="post" className="mt-6 max-w-2xl space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Nombre</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Color principal</span>
          {/* The browser's picker always gives "#rrggbb", the only format the API takes. */}
          <input
            type="color"
            name="primary_color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="mt-1 block h-10 w-20 cursor-pointer rounded-lg border border-gray-300"
          />
        </label>

        <div>
          <span className="text-sm font-medium">Vista previa</span>
          {/* The site's own header colors: the text color is picked for contrast, as the
              site does it (textColorOn), so a light color shows black text here too. */}
          <div
            data-testid="preview"
            style={{ backgroundColor: color, color: textColorOn(color) }}
            className="mt-1 rounded-lg px-4 py-3 font-semibold"
          >
            {name || 'Nombre'}
          </div>
        </div>

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
