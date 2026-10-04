import { expect, test } from '@playwright/test'

const QUESTION = '¿Qué necesito para el certificado de notas?'

test('the conversation survives navigating to another page', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('complementary')

  await panel.getByLabel('Tu pregunta').fill(QUESTION)
  await panel.getByRole('button', { name: 'Enviar' }).click()
  await expect(panel.getByText(QUESTION)).toBeVisible()
  // The wording changes from run to run; every right answer names the ID card.
  await expect(panel.getByRole('listitem').last()).toContainText(/carnet/i)

  await page.getByRole('link', { name: 'Lugares' }).click()
  await expect(page).toHaveURL(/\/locations$/)
  await expect(panel.getByText(QUESTION)).toBeVisible()
})
