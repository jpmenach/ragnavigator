import { Link } from 'react-router'
import type { CategoryWithEntries } from '../types'

export function HomePage({ categories }: { categories: CategoryWithEntries[] }) {
  return (
    <>
      <h1 className="text-3xl font-bold">Trámites y servicios</h1>
      <p className="mt-2 text-lg text-gray-600">
        Requisitos, costos, lugares y horarios de cada trámite.
      </p>

      {categories.map((category) => (
        <section key={category.slug} id={category.slug} className="mt-10">
          <h2 className="text-sm font-medium tracking-wide text-primary uppercase">
            {category.name}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {category.entries.map((entry) => (
              <li key={entry.slug}>
                <Link
                  to={`/entries/${entry.slug}`}
                  className="block h-full rounded-lg border border-gray-200 p-4 hover:border-primary"
                >
                  <span className="font-semibold">{entry.title}</span>
                  <span className="mt-1 block text-sm text-gray-600">{entry.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

export function HomeError() {
  return (
    <p className="text-gray-600">
      No pudimos cargar los trámites. Intenta de nuevo en unos minutos.
    </p>
  )
}
