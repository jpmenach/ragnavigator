import type { Location } from '../types'

export function LocationDetails({ location }: { location: Location }) {
  const place = [location.building, location.floor].filter(Boolean).join(', ')
  return (
    <div className="mt-1 space-y-0.5 text-sm text-gray-600">
      {place && <p>{place}</p>}
      {location.directions && <p>{location.directions}</p>}
      {location.hours && <p>{location.hours}</p>}
    </div>
  )
}
