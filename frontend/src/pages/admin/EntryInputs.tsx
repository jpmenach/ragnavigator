import type { Category, Entry } from '../../types'

const INPUT =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none'

// An entry's own fields, shared by the new-entry and edit forms. Uncontrolled: the form
// posts them as they are, and `entry` only sets where they start.
export function EntryInputs({
  entry,
  categories,
  category,
}: {
  entry?: Entry
  categories: Category[]
  category: string | null
}) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-medium">Título</span>
        <input
          name="title"
          defaultValue={entry?.title}
          required
          maxLength={200}
          className={INPUT}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Categoría</span>
        <select name="category" defaultValue={category ?? undefined} required className={INPUT}>
          {categories.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Resumen</span>
        <textarea
          name="summary"
          defaultValue={entry?.summary}
          required
          maxLength={500}
          rows={2}
          className={INPUT}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Costo</span>
          <input name="cost" defaultValue={entry?.cost ?? ''} maxLength={200} className={INPUT} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Duración</span>
          <input
            name="duration"
            defaultValue={entry?.duration ?? ''}
            maxLength={200}
            className={INPUT}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Observaciones</span>
        <textarea
          name="notes"
          defaultValue={entry?.notes ?? ''}
          maxLength={5000}
          rows={4}
          className={INPUT}
        />
      </label>
    </>
  )
}
