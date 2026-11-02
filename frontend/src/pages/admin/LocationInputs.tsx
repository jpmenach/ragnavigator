import type { Location } from '../../types'

const INPUT =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none'

// A place's fields, shared by the new-place and edit forms. Uncontrolled, like EntryInputs.
export function LocationInputs({ location }: { location?: Location }) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-medium">Nombre</span>
        <input
          name="name"
          defaultValue={location?.name}
          required
          maxLength={200}
          className={INPUT}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Edificio</span>
          <input
            name="building"
            defaultValue={location?.building ?? ''}
            maxLength={200}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Piso</span>
          <input
            name="floor"
            defaultValue={location?.floor ?? ''}
            maxLength={100}
            className={INPUT}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Cómo llegar</span>
        <textarea
          name="directions"
          defaultValue={location?.directions ?? ''}
          maxLength={2000}
          rows={2}
          className={INPUT}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Horario</span>
        <input
          name="hours"
          defaultValue={location?.hours ?? ''}
          maxLength={500}
          className={INPUT}
        />
      </label>
    </>
  )
}
