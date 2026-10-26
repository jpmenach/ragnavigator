import { useEffect, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import type { categoriesAction } from '../../adminRoutes'
import type { CategoryWithEntries } from '../../types'

const INPUT =
  'rounded-lg border border-gray-300 px-3 py-1.5 focus:border-primary focus:outline-none'

export function AdminEntriesPage({ categories }: { categories: CategoryWithEntries[] }) {
  return (
    <>
      <h1 className="text-2xl font-bold">Trámites</h1>
      {categories.map((category) => (
        <section key={category.slug} className="mt-8">
          <CategoryHeading category={category} />
          {category.entries.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Sin trámites todavía.</p>
          ) : (
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
          )}
        </section>
      ))}
      <NewCategory />
    </>
  )
}

// Each heading has its own fetcher: its forms post without leaving the page, and its
// pending state and error belong to this category alone.
function CategoryHeading({ category }: { category: CategoryWithEntries }) {
  const fetcher = useFetcher<typeof categoriesAction>()
  const [renaming, setRenaming] = useState(false)
  // While a rename is on its way, show the new name rather than the old one.
  const name = String(fetcher.formData?.get('name') ?? category.name)

  if (renaming) {
    return (
      <fetcher.Form
        method="post"
        onSubmit={() => setRenaming(false)}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="slug" value={category.slug} />
        <input
          name="name"
          defaultValue={category.name}
          aria-label="Nombre de la categoría"
          required
          maxLength={100}
          autoFocus
          className={INPUT}
        />
        <button
          type="submit"
          name="intent"
          value="rename"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setRenaming(false)}
          className="text-sm text-gray-600 hover:underline"
        >
          Cancelar
        </button>
      </fetcher.Form>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase">{name}</h2>
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="text-sm text-primary hover:underline"
        >
          Renombrar
        </button>
        {/* Only empty categories: the server refuses the rest, so don't offer it. */}
        {category.entries.length === 0 && (
          <fetcher.Form
            method="post"
            onSubmit={(event) => {
              if (!confirm(`¿Eliminar la categoría «${category.name}»?`)) {
                event.preventDefault()
              }
            }}
          >
            <input type="hidden" name="slug" value={category.slug} />
            <button
              type="submit"
              name="intent"
              value="delete"
              className="text-sm text-red-700 hover:underline"
            >
              Eliminar
            </button>
          </fetcher.Form>
        )}
      </div>
      {fetcher.data?.error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {fetcher.data.error}
        </p>
      )}
    </div>
  )
}

function NewCategory() {
  const fetcher = useFetcher<typeof categoriesAction>()
  const form = useRef<HTMLFormElement>(null)

  // Emptied once the category exists, ready for the next one. Not on an error: the name
  // stays there to be fixed.
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.error === null) {
      form.current?.reset()
    }
  }, [fetcher.state, fetcher.data])

  return (
    <section className="mt-10 border-t border-gray-200 pt-6">
      <h2 className="font-semibold">Nueva categoría</h2>
      <fetcher.Form ref={form} method="post" className="mt-2 flex flex-wrap gap-2">
        <input
          name="name"
          aria-label="Nombre de la nueva categoría"
          placeholder="Nombre"
          required
          maxLength={100}
          className={INPUT}
        />
        <button
          type="submit"
          name="intent"
          value="create"
          disabled={fetcher.state !== 'idle'}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          Agregar
        </button>
      </fetcher.Form>
      {fetcher.data?.error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {fetcher.data.error}
        </p>
      )}
    </section>
  )
}
