import type { Requirement } from '../../types'
import { ListEditor } from './ListEditor'

const INPUT =
  'block w-full rounded-lg border border-gray-300 px-3 py-1.5 focus:border-primary focus:outline-none'

export function RequirementsEditor({
  slug,
  requirements,
}: {
  slug: string
  requirements: Requirement[]
}) {
  return (
    <ListEditor
      action={`/admin/entries/${slug}/requirements`}
      initial={requirements}
      blank={{ name: '', description: null }}
      texts={{
        title: 'Requisitos',
        noun: 'requisito',
        empty: 'Sin requisitos.',
        saveLabel: 'Guardar requisitos',
        saved: 'Requisitos guardados.',
      }}
      fields={(requirement, number, update) => (
        <>
          <input
            name="name"
            value={requirement.name}
            onChange={(event) => update({ name: event.target.value })}
            aria-label={`Requisito ${number}`}
            placeholder="Requisito"
            required
            maxLength={200}
            className={INPUT}
          />
          <input
            name="description"
            value={requirement.description ?? ''}
            onChange={(event) => update({ description: event.target.value })}
            aria-label={`Detalle del requisito ${number}`}
            placeholder="Detalle (opcional)"
            maxLength={1000}
            className={`${INPUT} text-sm`}
          />
        </>
      )}
    />
  )
}
