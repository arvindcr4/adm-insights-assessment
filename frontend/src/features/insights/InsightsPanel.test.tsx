import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '@/test/render'
import { API, server } from '@/test/server'
import { InsightsPanel } from './InsightsPanel'
import { SEARCH_DEBOUNCE_MS } from './InsightsToolbar'

function renderPanel() {
  return renderWithStore(
    <InsightsPanel
      requestId="req-1"
      prompt="soybean"
      targetLanguage="en"
      turn={1}
      matchedKeywords={['soybean']}
    />,
  )
}

const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('InsightsPanel', () => {
  it('fetches page 1 and loads more pages from the backend metadata', async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(10))
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(20))
    await user.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(23))
    expect(screen.getByText(/all results loaded/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('debounces search and filters by text or metadata across loaded pages', async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(10))

    const search = screen.getByRole('searchbox', { name: /search insights/i })
    await user.type(search, 'brazil')
    // Not yet applied: debounce window still open.
    expect(screen.getAllByTestId('insight-card')).toHaveLength(10)
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(3), {
      timeout: SEARCH_DEBOUNCE_MS + 500,
    })
    // Insights 3, 6, 9 carry the 'brazil' tag in the fixture.
    expect(titles()).toEqual(['Insight 03', 'Insight 06', 'Insight 09'])

    await user.clear(search)
    await user.type(search, 'number 2')
    await waitFor(() => expect(titles()).toEqual(['Insight 02']), {
      timeout: SEARCH_DEBOUNCE_MS + 500,
    })

    await user.clear(search)
    await user.type(search, 'zzz-no-match')
    expect(
      await screen.findByText(/no insights match/i, {}, { timeout: SEARCH_DEBOUNCE_MS + 500 }),
    ).toBeInTheDocument()
  })

  it('sorts A–Z / Z–A by title or content', async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(10))
    expect(titles()[0]).toBe('Insight 01')

    await user.click(screen.getByRole('button', { name: /sort a to z/i }))
    expect(titles()[0]).toBe('Insight 10')
    expect(screen.getByRole('button', { name: /sort z to a/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'content')
    // Content is "Content for insight number N" → numeric-aware collation keeps 10 last when ascending.
    await user.click(screen.getByRole('button', { name: /sort z to a/i }))
    expect(titles()[0]).toBe('Insight 01')
    expect(titles().at(-1)).toBe('Insight 10')
  })

  it('shows a retryable error when the page fetch fails', async () => {
    server.use(
      http.get(API('/prompts/:requestId/insights'), () =>
        HttpResponse.json(
          { error: 'REQUEST_NOT_FOUND', message: 'Request not found or expired' },
          { status: 404 },
        ),
      ),
    )
    renderPanel()
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/request not found or expired/i)).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
