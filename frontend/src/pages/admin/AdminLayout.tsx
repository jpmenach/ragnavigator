import { Form, Link, NavLink, Outlet } from 'react-router'
import type { Admin } from '../../types'

// whitespace-nowrap: on a phone the links wrap as a whole ("Sin respuesta" stays together).
function navLinkClass({ isActive }: { isActive: boolean }) {
  const state = isActive ? 'font-medium text-primary' : 'text-gray-600 hover:underline'
  return `whitespace-nowrap ${state}`
}

export function AdminLayout({ admin }: { admin: Admin }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        {/* Wraps on a phone, so the username and "Cerrar sesión" aren't pushed off screen. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <Link to="/admin" className="text-lg font-semibold">
              Administración
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {/* `end`: /admin is a prefix of every admin URL, places included. */}
              <NavLink to="/admin" end className={navLinkClass}>
                Trámites
              </NavLink>
              <NavLink to="/admin/locations" className={navLinkClass}>
                Lugares
              </NavLink>
              <NavLink to="/admin/organization" className={navLinkClass}>
                Organización
              </NavLink>
              <NavLink to="/admin/unanswered" className={navLinkClass}>
                Sin respuesta
              </NavLink>
              <NavLink to="/admin/index" className={navLinkClass}>
                Índice
              </NavLink>
            </nav>
          </div>
          <div className="flex items-baseline gap-4 text-sm">
            <span className="text-gray-600">{admin.username}</span>
            <Form method="post" action="/admin/logout">
              <button type="submit" className="hover:underline">
                Cerrar sesión
              </button>
            </Form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function AdminError() {
  return (
    <p className="p-8 text-gray-600">
      No pudimos cargar la administración. Intenta de nuevo en unos minutos.
    </p>
  )
}
