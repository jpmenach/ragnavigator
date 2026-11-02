import { redirect } from 'react-router'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import {
  createCategory,
  createEntry,
  deleteCategory,
  deleteEntry,
  getCategories,
  getCurrentAdmin,
  getEntry,
  logIn,
  logOut,
  renameCategory,
  updateEntry,
} from './api'
import type { EntryFields } from './types'

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

// The entry and the categories it can be moved to, fetched together.
export async function entryLoader({ params, request }: LoaderFunctionArgs) {
  const [entry, categories] = await Promise.all([
    getEntry(params.slug!, request.signal),
    getCategories(request.signal),
  ])
  return { entry, categories }
}

// "Nuevo trámite" is offered under each category, which comes preselected (?category=).
export async function newEntryLoader({ request }: LoaderFunctionArgs) {
  const categories = await getCategories(request.signal)
  const category = new URL(request.url).searchParams.get('category')
  return { categories, category }
}

export async function newEntryAction({ request }: ActionFunctionArgs) {
  const { outcome, slug } = await createEntry(entryFields(await request.formData()))
  if (outcome === 'logged-out') {
    return redirect('/admin/login')
  }
  if (outcome === 'conflict') {
    return { error: 'Ya existe un trámite con ese título.' }
  }
  if (outcome === 'invalid') {
    return { error: 'No se pudo crear: revisa los campos.' }
  }
  // To its own page, where requirements and places will be added.
  return redirect(`/admin/entries/${slug}`)
}

// The entry form saves; its "Eliminar trámite" button posts here with intent=delete.
export async function entryAction({ params, request }: ActionFunctionArgs) {
  const form = await request.formData()
  if (form.get('intent') === 'delete') {
    const outcome = await deleteEntry(params.slug!)
    return redirect(outcome === 'logged-out' ? '/admin/login' : '/admin')
  }
  const outcome = await updateEntry(params.slug!, entryFields(form))
  if (outcome === 'logged-out') {
    return redirect('/admin/login')
  }
  return { saved: outcome === 'done' }
}

function entryFields(form: FormData): EntryFields {
  const field = (name: string) => String(form.get(name))
  return {
    category: field('category'),
    title: field('title'),
    summary: field('summary'),
    cost: field('cost'),
    duration: field('duration'),
    notes: field('notes'),
  }
}

// The entry list's category forms: new, rename, delete. One action for the page, told
// apart by the submit button's `intent`.
export async function categoriesAction({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const intent = form.get('intent')
  const slug = String(form.get('slug'))
  const name = String(form.get('name'))
  const result =
    intent === 'create'
      ? await createCategory(name)
      : intent === 'rename'
        ? await renameCategory(slug, name)
        : await deleteCategory(slug)

  if (result === 'logged-out') {
    return redirect('/admin/login')
  }
  if (result === 'conflict') {
    return {
      error:
        intent === 'delete'
          ? 'Esta categoría todavía tiene trámites.'
          : 'Ya existe una categoría con ese nombre.',
    }
  }
  if (result === 'invalid') {
    return { error: 'El nombre necesita al menos una letra o un número.' }
  }
  return { error: null }
}
