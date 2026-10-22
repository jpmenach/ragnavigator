import { redirect } from 'react-router'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { getCurrentAdmin, logIn, logOut } from './api'

// Loaders and actions for the admin pages. Kept out of the page files so Vite's fast
// refresh can still swap those components in place while editing them.

// The server decides: the cookie can't be read from here (HttpOnly), and hiding a page in
// the browser protects nothing anyway. Every admin API route checks the session itself.
export async function adminLoader({ request }: LoaderFunctionArgs) {
  const admin = await getCurrentAdmin(request.signal)
  if (admin === null) {
    return redirect('/admin/login')
  }
  return admin
}

// Already logged in (a bookmark, the back button): straight to the admin.
export async function loginLoader({ request }: LoaderFunctionArgs) {
  if (await getCurrentAdmin(request.signal)) {
    return redirect('/admin')
  }
  return null
}

export async function loginAction({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const admin = await logIn(String(form.get('username')), String(form.get('password')))
  if (admin === null) {
    return { error: 'Usuario o contraseña incorrectos.' }
  }
  return redirect('/admin')
}

export async function logoutAction() {
  await logOut()
  return redirect('/admin/login')
}
