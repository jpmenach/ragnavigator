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

test('a place is edited from the list of places, and a place in use is not deletable', async ({
  page,
}) => {
  await fakeAdminApi(page, { loggedIn: true })
  let saved: unknown
  await page.route('**/api/admin/locations/caja-central', (route) => {
    saved = route.request().postDataJSON()
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Lugares' }).click()

  await expect(page).toHaveURL(/\/admin\/locations$/)
  await expect(page.getByRole('link', { name: /Caja central/ })).toContainText('7 trámites')
  await page.getByRole('link', { name: /Caja central/ }).click()

  await expect(page.getByLabel('Piso')).toHaveValue('Planta baja')
  await expect(page.getByRole('button', { name: 'Eliminar lugar' })).toHaveCount(0)
  await page.getByLabel('Horario').fill('Lunes a viernes de 8:00 a 15:00.')
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByRole('status')).toHaveText('Guardado.')
  expect(saved).toMatchObject({ name: 'Caja central', hours: 'Lunes a viernes de 8:00 a 15:00.' })
})

test('a new place is created, and a taken name is explained', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  let created: unknown
  await page.route('**/api/admin/locations', (route) => {
    const body = route.request().postDataJSON()
    created = body
    return body.name === 'Caja central'
      ? route.fulfill({ status: 409, json: { detail: 'Taken' } })
      : route.fulfill({ status: 201, json: { ...body, slug: 'biblioteca' } })
  })
  await page.goto('/admin/locations')
  await page.getByRole('link', { name: '+ Nuevo lugar' }).click()

  await page.getByLabel('Nombre').fill('Caja central')
  await page.getByRole('button', { name: 'Crear lugar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Ya existe un lugar con ese nombre.')

  await page.getByLabel('Nombre').fill('Biblioteca')
  await page.getByLabel('Edificio').fill('Edificio C')
  await page.getByRole('button', { name: 'Crear lugar' }).click()
  await expect(page).toHaveURL(/\/admin\/locations$/)
  expect(created).toMatchObject({ name: 'Biblioteca', building: 'Edificio C', floor: '' })
})

test('an unused place can be deleted, after asking', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  // Every demo place is in use, so the list comes from a fake with an unused one.
  const biblioteca = {
    name: 'Biblioteca',
    slug: 'biblioteca',
    building: null,
    floor: null,
    directions: null,
    hours: null,
    entries: [],
  }
  await page.route('**/api/locations', (route) => route.fulfill({ json: [biblioteca] }))
  let deleted = false
  await page.route('**/api/admin/locations/biblioteca', (route) => {
    deleted = route.request().method() === 'DELETE'
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin/locations/biblioteca')

  await expect(page.getByText('Ninguno todavía.')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Eliminar lugar' }).click()

  await expect(page).toHaveURL(/\/admin\/locations$/)
  expect(deleted).toBe(true)
})

test('an unknown place says so', async ({ page }) => {
  await fakeAdminApi(page, { loggedIn: true })
  await page.goto('/admin/locations/no-existe')
  await expect(page.getByText('No encontramos este lugar.')).toBeVisible()
})

test('the organization form previews the color with readable text, then saves', async ({
  page,
}) => {
  await fakeAdminApi(page, { loggedIn: true })
  let saved: unknown
  await page.route('**/api/admin/organization', (route) => {
    saved = route.request().postDataJSON()
    return route.fulfill({ status: 204 })
  })
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Organización' }).click()
  // Wait for the page: until it's there, a "Nombre" label is still the entry list's
  // "Nombre de la nueva categoría", and fill() would type into that one.
  await expect(page.getByRole('heading', { name: 'Organización' })).toBeVisible()
  const preview = page.getByTestId('preview')

  await page.getByLabel('Nombre', { exact: true }).fill('Universidad Andina')
  await expect(preview).toHaveText('Universidad Andina')
  // A light color gets black text, a dark one white, as on the site.
  await page.getByLabel('Color principal').fill('#f5d90a')
  await expect(preview).toHaveCSS('color', 'rgb(0, 0, 0)')
  await page.getByLabel('Color principal').fill('#a31f34')
  await expect(preview).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByRole('status')).toHaveText('Guardado.')
  expect(saved).toEqual({ name: 'Universidad Andina', primary_color: '#a31f34' })
})

test.describe('unanswered questions', () => {
  // The API sends UTC; the page should show the admin's own time.
  test.use({ timezoneId: 'America/La_Paz' })

  test('are listed in local time, and dismissing one takes it off', async ({ page }) => {
    await fakeAdminApi(page, { loggedIn: true })
    let questions = [
      { id: 2, question: '¿Hay comedor?', asked_at: '2026-11-02T22:15:00Z' },
      { id: 1, question: '¿Dónde está la biblioteca?', asked_at: '2026-11-01T13:00:00Z' },
    ]
    await page.route('**/api/admin/unanswered**', (route) => {
      if (route.request().method() === 'DELETE') {
        const id = Number(new URL(route.request().url()).pathname.split('/').pop())
        questions = questions.filter((question) => question.id !== id)
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ json: questions })
    })
    await page.goto('/admin')
    await page.getByRole('link', { name: 'Sin respuesta' }).click()

    const comedor = page.getByRole('listitem').filter({ hasText: '¿Hay comedor?' })
    // 22:15 UTC is 18:15 in La Paz (UTC−4).
    await expect(comedor.locator('time')).toContainText('18:15')
    await comedor.getByRole('button', { name: 'Descartar' }).click()

    await expect(page.getByText('¿Hay comedor?')).toHaveCount(0)
    await expect(page.getByText('¿Dónde está la biblioteca?')).toBeVisible()
    expect(questions.map((question) => question.id)).toEqual([1])
  })
})

test('the index page lists what is out of date, and syncing brings it up to date', async ({
  page,
}) => {
  await fakeAdminApi(page, { loggedIn: true })
  let synced = false
  await page.route('**/api/admin/index-status/sync', (route) => {
    synced = true
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/admin/index-status', (route) =>
    route.fulfill({
      json: {
        entries: [
          { slug: 'certificado-de-notas', name: 'Certificado de notas', up_to_date: synced },
          { slug: 'beca', name: 'Beca', up_to_date: true },
        ],
        locations: [{ slug: 'caja-central', name: 'Caja central', up_to_date: true }],
        orphans: synced ? 0 : 2,
      },
    }),
  )
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Índice' }).click()

  await expect(page.getByRole('heading', { name: 'Trámites desactualizados' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Certificado de notas' })).toHaveAttribute(
    'href',
    '/admin/entries/certificado-de-notas',
  )
  await expect(page.getByText('2 documentos de cosas que ya se eliminaron.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lugares desactualizados' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Reindexar lo desactualizado' }).click()

  await expect(page.getByRole('status')).toHaveText('Todo al día: 2 trámites y 1 lugar.')
  expect(synced).toBe(true)
})
