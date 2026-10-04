import { Link, Outlet, ScrollRestoration } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-4">
          {/* Hardcoded until there are organization settings to read it from. */}
          <Link to="/" className="text-lg font-semibold">
            Universidad Nueva Cordillera
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
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
      {/* Without it, a client-side navigation keeps the previous page's scroll position.
          It also scrolls to #anchors, e.g. a category on the home page. */}
      <ScrollRestoration />
    </div>
  )
}
