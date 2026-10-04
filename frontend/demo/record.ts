// Records the demo clip: real questions, real answers from the local LLM, the site moving
// on its own. Unlike the e2e tests, nothing is faked, so answers vary between recordings:
// watch the result before using it.
//
// With the app running (seeded, indexed, Ollama up):
//   uv run fastapi run src/ragnavigator/main.py        (repo root, after `npm run build`)
//   npm run demo                                        (frontend/)
// The video lands in frontend/demo-output/, with a screenshot after each answer.

import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import { renameSync } from 'node:fs'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000'
const OUTPUT = 'demo-output'
const SIZE = { width: 1280, height: 800 }

const QUESTIONS = [
  '¿Qué necesito para el certificado de notas?',
  '¿A qué hora atiende la secretaría general?',
  '¿Tienen estacionamiento para bicicletas?',
]

async function ask(page: Page, question: string, step: number) {
  const panel = page.getByRole('complementary')
  // Typed at a readable pace, so the clip shows a person asking.
  await panel.getByLabel('Tu pregunta').pressSequentially(question, { delay: 45 })
  await page.waitForTimeout(400)
  await panel.getByRole('button', { name: 'Enviar' }).click()
  await panel.getByText('Buscando…').waitFor({ state: 'detached', timeout: 120_000 })
  // Long enough to read the answer and see the highlight fade.
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUTPUT}/step-${step}.png` })
  await page.waitForTimeout(1000)
}

// The first question loads the embedding model and the LLM, which takes tens of seconds.
// Done before recording, so the clip doesn't open on a long wait.
console.log('Warming up the assistant…')
await fetch(`${BASE_URL}/api/ask`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'hola' }),
})

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: OUTPUT, size: SIZE },
})
const page = await context.newPage()
await page.goto(BASE_URL)
await page.waitForTimeout(2000)

for (const [index, question] of QUESTIONS.entries()) {
  console.log(`Asking: ${question}`)
  await ask(page, question, index + 1)
}

const video = page.video()
await context.close()
await browser.close()
if (video) {
  const path = `${OUTPUT}/ragnavigator-demo.webm`
  renameSync(await video.path(), path)
  console.log(`Saved ${path}`)
}
