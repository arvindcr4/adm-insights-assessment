import { expect, type Page } from '@playwright/test'

export async function submitPrompt(page: Page, prompt: string, language?: string) {
  if (language) await page.getByRole('combobox').first().selectOption(language)
  await page.getByRole('textbox').first().fill(prompt)
  await page
    .getByRole('button', {
      name: /get insights|obtener insights|obtenir des insights|insights abrufen/i,
    })
    .click()
}

export async function expectCards(page: Page, count: number) {
  await expect(page.getByTestId('insight-card')).toHaveCount(count)
}
