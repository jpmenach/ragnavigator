import type { EntryLocation, EntryPlace, LocationWithEntries } from '../../types'
import { ListEditor } from './ListEditor'

const INPUT =
  'block w-full rounded-lg border border-gray-300 px-3 py-1.5 focus:border-primary focus:outline-none'

// The entry's places, in step order ("request here, pay there"). Places are picked from
// the existing ones: they're shared with other entries, so they're edited on their own.
export function PlacesEditor({
  slug,
  links,
  locations,
}: {
  slug: string
  links: EntryLocation[]
  locations: LocationWithEntries[]
}) {
  // The roles already in the catalog, offered as suggestions: the same wording everywhere
  // reads better on the locations page. Any other role can still be typed.
  const roles = [
    ...new Set(locations.flatMap((location) => location.entries.map((link) => link.role))),
  ]

  return (
    <>
      <datalist id="place-roles">
        {roles.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
      <ListEditor<EntryPlace>
        action={`/admin/entries/${slug}/locations`}
        initial={links.map((link) => ({ location: link.location.slug, role: link.role }))}
        blank={{ location: '', role: '' }}
        texts={{
          title: 'Dónde y cuándo',
          noun: 'lugar',
          empty: 'Sin lugares.',
          saveLabel: 'Guardar lugares',
          saved: 'Lugares guardados.',
        }}
        fields={(place, number, update) => (
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <select
              name="location"
              value={place.location}
              onChange={(event) => update({ location: event.target.value })}
              aria-label={`Lugar ${number}`}
              required
              className={INPUT}
            >
              <option value="" disabled>
                Elige un lugar…
              </option>
              {locations.map((location) => (
                <option key={location.slug} value={location.slug}>
                  {location.name}
                </option>
              ))}
            </select>
            <input
              name="role"
              value={place.role}
              onChange={(event) => update({ role: event.target.value })}
              list="place-roles"
              aria-label={`Qué se hace en el lugar ${number}`}
              placeholder="Solicitud, Pago…"
              required
              maxLength={100}
              className={INPUT}
            />
          </div>
        )}
      />
    </>
  )
}
