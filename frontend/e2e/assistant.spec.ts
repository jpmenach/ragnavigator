import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { AskResponse } from '../src/types'

// These tests check what the frontend does with an answer, so /api/ask is replaced with a
// fixed response. The real LLM varies from run to run (it refused this very question 1 time
// in 20), and answer quality is the evaluation script's job
// (examples/universidad-demo/scripts/query_test.py). Pages and PDFs still come from the
// real API and database.
async function answerWith(page: Page, response: AskResponse) {
  await page.route('**/api/ask', (route) => route.fulfill({ json: response }))
}

async function ask(page: Page, question: string) {
  const panel = page.getByRole('complementary')
  await panel.getByLabel('Tu pregunta').fill(question)
  await panel.getByRole('button', { name: 'Enviar' }).click()
  return panel
}

const REQUIREMENTS_ANSWER: AskResponse = {
  answer: 'Necesitas una fotocopia de carnet de identidad y un comprobante de pago.',
  grounded: true,
  sources: [],
  actions: [
    { type: 'navigate', to: '/entries/certificado-de-notas#requirements' },
    { type: 'highlight', target: 'requirements' },
    {
      type: 'offer_download',
      url: '/api/entries/certificado-de-notas/requirements.pdf',
      label: 'Descargar requisitos (PDF)',
    },
  ],
}

test('the conversation survives navigating to another page', async ({ page }) => {
  await answerWith(page, { answer: 'Respuesta de prueba.', grounded: true, sources: [], actions: [] })
  await page.goto('/')
  const panel = await ask(page, '¿Qué necesito para el certificado de notas?')
  await expect(panel.getByText('Respuesta de prueba.')).toBeVisible()

  await page.getByRole('link', { name: 'Lugares' }).click()
  await expect(page).toHaveURL(/\/locations$/)
  await expect(panel.getByText('¿Qué necesito para el certificado de notas?')).toBeVisible()
  await expect(panel.getByText('Respuesta de prueba.')).toBeVisible()
})

test('an answer opens the right section, highlights it and offers the PDF', async ({ page }) => {
  await answerWith(page, REQUIREMENTS_ANSWER)
  await page.goto('/')
  const panel = await ask(page, '¿Qué necesito para el certificado de notas?')

  await expect(page).toHaveURL(/\/entries\/certificado-de-notas#requirements$/)
  await expect(page.locator('#requirements')).toHaveClass(/assistant-highlight/)
  await expect(panel.getByText('→ Resalté los requisitos')).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Descargar requisitos (PDF)' })).toHaveAttribute(
    'href',
    '/api/entries/certificado-de-notas/requirements.pdf',
  )
})

test('a question about a place opens that place on the locations page', async ({ page }) => {
  await answerWith(page, {
    answer: 'La secretaría general atiende de 9:00 a 12:00.',
    grounded: true,
    sources: [],
    actions: [
      { type: 'navigate', to: '/locations#secretaria-general' },
      { type: 'highlight', target: 'secretaria-general' },
    ],
  })
  await page.goto('/')
  const panel = await ask(page, '¿A qué hora atiende la secretaría general?')

  await expect(page).toHaveURL(/\/locations#secretaria-general$/)
  await expect(page.locator('#secretaria-general')).toHaveClass(/assistant-highlight/)
  await expect(panel.getByRole('link', { name: /PDF/ })).toHaveCount(0)
})

test('a question the catalog can not answer stays put and says so', async ({ page }) => {
  await answerWith(page, { answer: '', grounded: false, sources: [], actions: [] })
  await page.goto('/locations')
  const panel = await ask(page, '¿Tienen estacionamiento para bicicletas?')

  await expect(panel.getByText('No tengo esa información en el catálogo de trámites.')).toBeVisible()
  await expect(page).toHaveURL(/\/locations$/)
})
