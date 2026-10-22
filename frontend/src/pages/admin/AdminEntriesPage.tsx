import { Link } from 'react-router'
import type { CategoryWithEntries } from '../../types'

export function AdminEntriesPage({ categories }: { categories: CategoryWithEntries[] }) {
  return (
    <>
      <h1 className="text-2xl font-bold">Trámites</h1>
      {categories.map((category) => (
        <section key={category.slug} className="mt-8">
          <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase">
            {category.name}
          </h2>
          <ul className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
            {category.entries.map((entry) => (
              <li key={entry.slug}>
                <Link
                  to={`/admin/entries/${entry.slug}`}
                  className="block px-2 py-3 hover:bg-gray-50"
                >
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
