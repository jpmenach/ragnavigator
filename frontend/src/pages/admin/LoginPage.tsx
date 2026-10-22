import { Form, useActionData, useNavigation } from 'react-router'
import type { loginAction } from '../../adminRoutes'

export function LoginPage() {
  const result = useActionData<typeof loginAction>()
  const submitting = useNavigation().state !== 'idle'

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="mt-1 text-gray-600">Ingresa para editar el catálogo.</p>

      {/* A real form, posted to the route's action: the browser's password manager
          recognizes it, and it works with Enter like any login. */}
      <Form method="post" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Usuario</span>
          <input
            name="username"
            autoComplete="username"
            required
            maxLength={100}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        {result?.error && (
          <p role="alert" className="text-sm text-red-700">
            {result.error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </Form>
    </main>
  )
}
