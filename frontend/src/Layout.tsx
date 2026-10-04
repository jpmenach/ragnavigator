import { Link, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="bg-primary text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          {/* Hardcoded until there are organization settings to read it from. */}
          <Link to="/" className="text-lg font-semibold">
            Universidad Nueva Cordillera
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
