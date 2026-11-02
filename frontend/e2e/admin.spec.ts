import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// The admin API is replaced with a small fake that remembers whether someone logged in.
// These tests check what the pages do (redirects, the error, logging out, what a save
// sends); sessions, cookies and saving are checked against the real API by the backend
// tests (tests/), and a fake keeps the database these tests share with the site unchanged.
async function fakeAdminApi(page: Page, { loggedIn = false } = {}) {
  await page.route('**/api/admin/me', (route) =>
    loggedIn
      ? route.fulfill({ json: { username: 'ana' } })
      : route.fulfill({ status: 401, json: { detail: 'Not logged in' } }),
  )
  await page.route('**/api/admin/login', (route) => {
    loggedIn = route.request().postDataJSON().password === 'la-contraseña-correcta'
    return loggedIn
      ? route.fulfill({ json: { username: 'ana' } })
      : route.fulfill({ status: 401, json: { detail: 'Wrong username or password' } })
  })
  await page.route('**/api/admin/logout', (route) => {
    loggedIn = false
    return route.fulfill({ status: 204 })
  })
}

async function logIn(page: Page, password: string) {
  await page.getByLabel('Usuario').fill('ana')
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

test('the admin asks for a login first', async ({ page }) => {
  await fakeAdminApi(page)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('a wrong password shows an error and stays on the login', async ({ page }) => {
  await fakeAdminApi(page)
  await page.goto('/admin/login')
  await logIn(page, 'otra-cosa')

  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('logging in opens the admin, and logging out leaves it', async ({ page }) => {
  await fakeAdminApi(page)
  await page.goto('/admin/login')
  await logIn(page, 'la-contraseña-correcta')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText('ana')).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('editing an entry sends the form and says it saved', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  let saved: unknown
  await page.route('**/api/admin/entries/certificado-de-notas', (route) => {
    saved = route.request().postDataJSON()
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Certificado de notas' }).click()

  await expect(page.getByLabel('Título')).toHaveValue('Certificado de notas')
  await page.getByLabel('Costo').fill('60 bolivianos (Bs)')
  // Exact: the requirements below have their own "Guardar requisitos".
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Guardado.')
  expect(saved).toMatchObject({ title: 'Certificado de notas', cost: '60 bolivianos (Bs)' })
})

// Categories come from a fake too, so a test can have an empty one (the demo has none).
const CATEGORIES = [
  {
    name: 'Titulación',
    slug: 'titulacion',
    entries: [{ title: 'Diploma', slug: 'diploma', summary: '.' }],
  },
  { name: 'Deportes', slug: 'deportes', entries: [] },
]

async function fakeCategories(page: Page) {
  const requests: { method: string; url: string; body: unknown }[] = []
  await page.route('**/api/categories', (route) => route.fulfill({ json: CATEGORIES }))
  await page.route('**/api/admin/categories**', (route) => {
    const request = route.request()
    const body = request.postDataJSON()
    requests.push({ method: request.method(), url: new URL(request.url()).pathname, body })
    if (body?.name === 'Titulación') {
      return route.fulfill({ status: 409, json: { detail: 'Taken' } })
    }
    return route.fulfill({ status: request.method() === 'POST' ? 201 : 204 })
  })
  return requests
}

test('a new category is sent, and a taken name is explained', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  const requests = await fakeCategories(page)
  await page.goto('/admin')
  const name = page.getByLabel('Nombre de la nueva categoría')

  await name.fill('Becas')
  await page.getByRole('button', { name: 'Agregar' }).click()
  await expect(name).toHaveValue('')
  expect(requests).toEqual([
    { method: 'POST', url: '/api/admin/categories', body: { name: 'Becas' } },
  ])

  await name.fill('Titulación')
  await page.getByRole('button', { name: 'Agregar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Ya existe una categoría con ese nombre.')
  await expect(name).toHaveValue('Titulación')
})

test('a category can be renamed', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  const requests = await fakeCategories(page)
  await page.goto('/admin')

  await page.getByRole('button', { name: 'Renombrar' }).first().click()
  await page.getByLabel('Nombre de la categoría').fill('Títulos')
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => requests).toEqual([
    { method: 'PUT', url: '/api/admin/categories/titulacion', body: { name: 'Títulos' } },
  ])
})

test('only an empty category offers to be deleted', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  const requests = await fakeCategories(page)
  await page.goto('/admin')

  await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Eliminar' }).click()

  await expect.poll(() => requests).toEqual([
    { method: 'DELETE', url: '/api/admin/categories/deportes', body: null },
  ])
})

test('a new entry starts in the chosen category and opens once created', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  await fakeCategories(page)
  let created: unknown
  await page.route('**/api/admin/entries', (route) => {
    const body = route.request().postDataJSON()
    created = body
    return body.title === 'Diploma'
      ? route.fulfill({ status: 409, json: { detail: 'Taken' } })
      : route.fulfill({ status: 201, json: { title: 'Beca', slug: 'beca', summary: '.' } })
  })
  await page.route('**/api/entries/beca', (route) =>
    route.fulfill({
      json: {
        title: 'Beca',
        slug: 'beca',
        summary: 'Una beca.',
        cost: null,
        duration: null,
        notes: null,
        category: { name: 'Deportes', slug: 'deportes' },
        requirements: [],
        locations: [],
      },
    }),
  )
  await page.goto('/admin')

  await page.getByRole('link', { name: '+ Nuevo trámite' }).nth(1).click()
  await expect(page.getByLabel('Categoría')).toHaveValue('deportes')

  await page.getByLabel('Título').fill('Diploma')
  await page.getByLabel('Resumen').fill('Una beca.')
  await page.getByRole('button', { name: 'Crear trámite' }).click()
  await expect(page.getByRole('alert')).toHaveText('Ya existe un trámite con ese título.')

  await page.getByLabel('Título').fill('Beca')
  await page.getByRole('button', { name: 'Crear trámite' }).click()
  await expect(page).toHaveURL(/\/admin\/entries\/beca$/)
  expect(created).toMatchObject({ title: 'Beca', category: 'deportes', summary: 'Una beca.' })
})

test('deleting an entry asks first, then goes back to the list', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  let deleted = false
  await page.route('**/api/admin/entries/certificado-de-notas', (route) => {
    deleted = route.request().method() === 'DELETE'
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin/entries/certificado-de-notas')

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Eliminar trámite' }).click()
  await expect(page).toHaveURL(/\/admin\/entries\/certificado-de-notas$/)
  expect(deleted).toBe(false)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Eliminar trámite' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  expect(deleted).toBe(true)
})

test('requirements are reordered, edited, removed and added, then saved as one list', async ({
  page,
}) => {
  await fakeAdminApi(page, { loggedIn: true })
  let saved: unknown
  await page.route('**/api/admin/entries/certificado-de-notas/requirements', (route) => {
    saved = route.request().postDataJSON()
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin/entries/certificado-de-notas')
  // The demo's three: carnet, comprobante de pago, formulario.
  await expect(page.getByLabel(/^Requisito \d$/)).toHaveCount(3)

  await page.getByRole('button', { name: 'Subir el requisito 2' }).click()
  await page.getByLabel('Requisito 2', { exact: true }).fill('Fotocopia de carnet vigente')
  await page.getByRole('button', { name: 'Quitar el requisito 3' }).click()
  await page.getByRole('button', { name: '+ Agregar requisito' }).click()
  await page.getByLabel('Requisito 3', { exact: true }).fill('Matrícula del semestre')
  await page.getByRole('button', { name: 'Guardar requisitos' }).click()

  await expect(page.getByRole('status')).toHaveText('Requisitos guardados.')
  expect(saved).toEqual([
    { name: 'Comprobante de pago del trámite', description: 'Se obtiene en caja central.' },
    { name: 'Fotocopia de carnet vigente', description: '' },
    { name: 'Matrícula del semestre', description: '' },
  ])
})

test('places are picked from the existing ones, with a role, and saved in order', async ({
  page,
}) => {
  await fakeAdminApi(page, { loggedIn: true })
  let saved: unknown
  await page.route('**/api/admin/entries/certificado-de-notas/locations', (route) => {
    saved = route.request().postDataJSON()
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin/entries/certificado-de-notas')
  // The demo's three: request at the platform, pay at the cashier, pick up at the platform.
  await expect(page.getByLabel(/^Lugar \d$/)).toHaveCount(3)

  await page.getByRole('button', { name: 'Subir el lugar 2' }).click()
  await page.getByLabel('Lugar 3', { exact: true }).selectOption('Registros académicos')
  await page.getByRole('button', { name: '+ Agregar lugar' }).click()
  await page.getByLabel('Lugar 4', { exact: true }).selectOption('Secretaría general')
  await page.getByLabel('Qué se hace en el lugar 4').fill('Legalización')
  await page.getByRole('button', { name: 'Guardar lugares' }).click()

  await expect(page.getByRole('status')).toHaveText('Lugares guardados.')
  expect(saved).toEqual([
    { location: 'caja-central', role: 'Pago' },
    { location: 'plataforma-de-atencion', role: 'Solicitud' },
    { location: 'registros-academicos', role: 'Entrega' },
    { location: 'secretaria-general', role: 'Legalización' },
  ])
})
