import { Form, Link, Outlet } from 'react-router'
import type { Admin } from '../../types'

export function AdminLayout({ admin }: { admin: Admin }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-6 px-4 py-4">
          <Link to="/admin" className="text-lg font-semibold">
            Administración
          </Link>
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
