import { expect, test } from '@playwright/test'
import { expectCards, submitPrompt } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('clarification for a too-short prompt', async ({ page }) => {
  await submitPrompt(page, 'hi')
  const status = page.getByRole('status')
  await expect(status).toContainText('We need a bit more detail')
  await expect(status).toContainText('too short')
  await expect(page.getByRole('region', { name: 'Conversation history' })).toContainText(
    'needs clarification',
  )
})

test('success, load more, search, sort', async ({ page }) => {
  await submitPrompt(page, 'soybean crush margins in brazil')
  await expect(page.getByRole('heading', { name: /insights for/i })).toBeVisible()
  await expectCards(page, 10)
  await expect(page.getByText(/page 1 of 2/i)).toBeVisible()

  await page.getByRole('button', { name: 'Load more' }).click()
  await expectCards(page, 19)
  await expect(page.getByText('All results loaded')).toBeVisible()

  await page.getByRole('searchbox').fill('brazil')
  await expect(page.getByText(/showing 5 of 19 loaded/i)).toBeVisible()

  const firstTitle = page.getByTestId('insight-card').first().getByRole('heading')
  const before = await firstTitle.textContent()
  await page.getByRole('button', { name: /sort a to z/i }).click()
  await expect(firstTitle).not.toHaveText(before ?? '')
  await expect(page.getByRole('button', { name: /sort z to a/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('structured 4xx from the BFF is shown and dismissable', async ({ page }) => {
  await page.route('**/api/v1/prompts', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'INVALID_LANGUAGE',
        message: 'Target language is not supported',
      }),
    }),
  )
  await submitPrompt(page, 'hello world')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('INVALID_LANGUAGE, HTTP 400')
  await alert.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText('Ask something to get started')).toBeVisible()
})

test('whole UI and content follow the target language', async ({ page }) => {
  await page.getByRole('combobox').first().selectOption('de')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights-Konsole')
  await expect(page).toHaveTitle('Insights-Konsole')
  await submitPrompt(page, 'soybean crush margins in brazil')
  await expect(page.getByRole('heading', { name: /insights zu/i })).toBeVisible()
  await expect(page.getByTestId('insight-card').first()).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('button', { name: 'Mehr laden' })).toBeVisible()
})

test('history re-opens a past answer and state survives a reload', async ({ page }) => {
  await submitPrompt(page, 'soybean crush margins in brazil')
  await expectCards(page, 10)
  await submitPrompt(page, 'hi')
  await expect(page.getByRole('status')).toContainText('more detail')

  await page
    .getByRole('button', { name: /re-open: soybean crush margins in brazil \(19 insights\)/i })
    .click()
  await expectCards(page, 10)

  await page.reload()
  await expect(page.getByRole('region', { name: 'Conversation history' })).toContainText(
    '19 insights',
  )
  await expectCards(page, 10)
})

test('narrow viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await submitPrompt(
    page,
    'soybeancrushmarginsaveryveryverylongunbrokenwordthatshouldwrapratherthanoverflow soybean brazil',
  )
  await expectCards(page, 10)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
