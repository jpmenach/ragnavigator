import { data, redirect } from 'react-router'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import {
  createCategory,
  createEntry,
  createLocation,
  deleteCategory,
  deleteEntry,
  deleteLocation,
  getCategories,
  getCurrentAdmin,
  getEntry,
  getLocations,
  logIn,
  logOut,
  renameCategory,
  replaceLocations,
  replaceRequirements,
  updateEntry,
  updateLocation,
} from './api'
import type { EntryFields, LocationFields } from './types'

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

// The entry, the categories it can be moved to and the places it can be linked to,
// fetched together.
export async function entryLoader({ params, request }: LoaderFunctionArgs) {
  const [entry, categories, locations] = await Promise.all([
    getEntry(params.slug!, request.signal),
    getCategories(request.signal),
    getLocations(request.signal),
  ])
  return { entry, categories, locations }
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

// The requirements editor posts here (its own route, so its result doesn't mix with the
// entry form's). Each row has a `name` and a `description` input; getAll() returns them in
// the order they're on screen, which is the list's order.
export async function requirementsAction({ params, request }: ActionFunctionArgs) {
  const form = await request.formData()
  const descriptions = form.getAll('description')
  const requirements = form.getAll('name').map((name, i) => ({
    name: String(name),
    description: String(descriptions[i]),
  }))
  const outcome = await replaceRequirements(params.slug!, requirements)
  if (outcome === 'logged-out') {
    return redirect('/admin/login')
  }
  return { saved: outcome === 'done' }
}

// The places editor's rows: a `location` select and a `role` input each, in screen order.
export async function locationsAction({ params, request }: ActionFunctionArgs) {
  const form = await request.formData()
  const roles = form.getAll('role')
  const places = form.getAll('location').map((location, i) => ({
    location: String(location),
    role: String(roles[i]),
  }))
  const outcome = await replaceLocations(params.slug!, places)
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

// There's no endpoint for one place: the list is short, so the page picks it from there.
export async function locationLoader({ params, request }: LoaderFunctionArgs) {
  const locations = await getLocations(request.signal)
  const location = locations.find((location) => location.slug === params.slug)
  if (location === undefined) {
    throw data('Place not found', { status: 404 })
  }
  return location
}

export async function newLocationAction({ request }: ActionFunctionArgs) {
  const outcome = await createLocation(locationFields(await request.formData()))
  if (outcome === 'logged-out') {
    return redirect('/admin/login')
  }
  if (outcome === 'conflict') {
    return { error: 'Ya existe un lugar con ese nombre.' }
  }
  if (outcome === 'invalid') {
    return { error: 'No se pudo crear: revisa los campos.' }
  }
  // Back to the list: unlike an entry, a place has nothing left to add on its own page.
  return redirect('/admin/locations')
}

// Like entryAction: the form saves, "Eliminar lugar" posts intent=delete.
export async function locationAction({ params, request }: ActionFunctionArgs) {
  const form = await request.formData()
  if (form.get('intent') === 'delete') {
    const outcome = await deleteLocation(params.slug!)
    if (outcome === 'conflict') {
      // The page only offers it for unused places, but an entry may have just been linked.
      return { saved: false, error: 'Algún trámite todavía usa este lugar.' }
    }
    return redirect(outcome === 'logged-out' ? '/admin/login' : '/admin/locations')
  }
  const outcome = await updateLocation(params.slug!, locationFields(form))
  if (outcome === 'logged-out') {
    return redirect('/admin/login')
  }
  return { saved: outcome === 'done', error: null }
}

function locationFields(form: FormData): LocationFields {
  const field = (name: string) => String(form.get(name))
  return {
    name: field('name'),
    building: field('building'),
    floor: field('floor'),
    directions: field('directions'),
    hours: field('hours'),
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
