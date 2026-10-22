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
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByRole('status')).toHaveText('Guardado.')
  expect(saved).toMatchObject({ title: 'Certificado de notas', cost: '60 bolivianos (Bs)' })
})
