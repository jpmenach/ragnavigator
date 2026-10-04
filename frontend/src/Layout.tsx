import { useLayoutEffect } from 'react'
import { Link, Outlet, ScrollRestoration } from 'react-router'
import { AssistantPanel } from './components/AssistantPanel'
import { applyTheme } from './theme'
import type { Organization } from './types'

export function Layout({ organization }: { organization: Organization }) {
  // Layout effect, not a plain effect: it runs before the browser paints, so the page never
  // flashes the fallback color first.
  useLayoutEffect(() => {
    applyTheme(organization)
    document.title = organization.name
  }, [organization])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="bg-primary text-on-primary">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-4">
          <Link to="/" className="text-lg font-semibold">
            {organization.name}
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="hover:underline">
              Trámites
            </Link>
            <Link to="/locations" className="hover:underline">
              Lugares
            </Link>
          </nav>
        </div>
      </header>
      {/* Page and assistant side by side on large screens; on small ones the assistant is a
          bottom sheet. The page column keeps a readable width either way. */}
      <div className="mx-auto max-w-6xl gap-8 px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="max-w-3xl">
          <Outlet />
        </main>
        <AssistantPanel />
      </div>
      {/* Without it, a client-side navigation keeps the previous page's scroll position.
          It also scrolls to #anchors, e.g. a category on the home page. */}
      <ScrollRestoration />
    </div>
  )
}

// Without the organization there's no name or header to show, so this replaces the layout.
export function LayoutError() {
  return (
    <p className="p-8 text-gray-600">
      No pudimos cargar el sitio. Intenta de nuevo en unos minutos.
    </p>
  )
}
