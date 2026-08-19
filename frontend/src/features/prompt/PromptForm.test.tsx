import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { CONTEXT_ID, REQUEST_ID } from '@/test/fixtures'
import { renderWithStore } from '@/test/render'
import { API, server } from '@/test/server'
import { ConversationHistory } from './ConversationHistory'
import { PromptForm } from './PromptForm'
import { PromptOutcome } from './PromptOutcome'

function Page() {
  return (
    <>
      <PromptForm />
      <PromptOutcome />
      <ConversationHistory />
    </>
  )
}

describe('PromptForm', () => {
  it('keeps submit disabled until the schema is satisfied', async () => {
    const user = userEvent.setup()
    renderWithStore(<PromptForm />)
    const submit = screen.getByRole('button', { name: /get insights/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'soybean crush margins')
    await waitFor(() => expect(submit).toBeEnabled())

    await user.clear(screen.getByRole('textbox', { name: 'Prompt' }))
    await waitFor(() => expect(submit).toBeDisabled())
    expect(await screen.findByText('Prompt is required')).toBeInTheDocument()
  })

  it('loads languages from the API into the dropdown', async () => {
    renderWithStore(<PromptForm />)
    await waitFor(() => expect(screen.getByRole('option', { name: /Deutsch/ })).toBeInTheDocument())
    expect(screen.getByLabelText(/target language/i)).toHaveValue('en')
  })

  it('renders insights on SUCCESS from the POST payload (no page-1 refetch) and keeps the context id', async () => {
    const user = userEvent.setup()
    const requests: string[] = []
    const onRequest = ({ request }: { request: Request }) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    server.events.on('request:start', onRequest)

    const { store } = renderWithStore(<Page />)
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'soybean crush margins')
    await user.click(screen.getByRole('button', { name: /get insights/i }))

    expect(await screen.findByRole('heading', { name: /insights for/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('insight-card')).toHaveLength(10)
    expect(
      screen.getByText(new RegExp(`Conversation ${CONTEXT_ID.slice(0, 8)}`)),
    ).toBeInTheDocument()
    expect(store.getState().prompt.history).toHaveLength(1)

    // Page 1 came from the POST; the infinite query was seeded, so no GET for it.
    expect(requests.filter((r) => r.startsWith('GET') && r.includes('/insights'))).toEqual([])
    // "Load more" then fetches page 2 only.
    await user.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(20))
    expect(requests.filter((r) => r.includes('/insights'))).toEqual([
      `GET /api/v1/prompts/${REQUEST_ID}/insights`,
    ])
    server.events.removeListener('request:start', onRequest)
  })

  it('shows a clarification message for short prompts', async () => {
    const user = userEvent.setup()
    renderWithStore(<Page />)
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'hi')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/need a bit more detail/i)
    expect(screen.getByText(/too short/i)).toBeInTheDocument()
  })

  it('renders a structured 4xx error from the BFF, with details', async () => {
    server.use(
      http.post(API('/prompts'), () =>
        HttpResponse.json(
          {
            error: 'INVALID_LANGUAGE',
            message: 'Target language is not supported',
            details: { supportedLanguages: ['en', 'fr'] },
          },
          { status: 400 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithStore(<Page />)
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'hello world')
    await user.click(screen.getByRole('button', { name: /get insights/i }))

    const alert = await screen.findByRole('alert')
    // Title is localized by error code; the server's own message is still shown underneath.
    expect(alert).toHaveTextContent(
      'That target language is not supported (INVALID_LANGUAGE, HTTP 400)',
    )
    expect(alert).toHaveTextContent('Target language is not supported')
    expect(alert).toHaveTextContent('supportedLanguages')
    expect(screen.getByRole('region', { name: /conversation history/i })).toHaveTextContent(
      'INVALID_LANGUAGE',
    )
  })

  it('renders per-field validation details for a 422', async () => {
    server.use(
      http.post(API('/prompts'), () =>
        HttpResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [
              { field: 'contextId', code: 'uuid_parsing', message: 'Input should be a valid UUID' },
            ],
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithStore(<Page />)
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'hello world')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('contextId')
    expect(alert).toHaveTextContent('Input should be a valid UUID')
  })

  it('falls back to default languages and says so when the languages call fails', async () => {
    server.use(http.get(API('/languages'), () => HttpResponse.error()))
    renderWithStore(<PromptForm />)
    expect(await screen.findByText(/could not load languages/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /English/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Deutsch/ })).not.toBeInTheDocument()
  })

  it('re-opens a past answer from the history panel', async () => {
    const user = userEvent.setup()
    renderWithStore(<Page />)
    const prompt = screen.getByRole('textbox', { name: 'Prompt' })
    await user.type(prompt, 'soybean crush margins')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    await screen.findByRole('heading', { name: /insights for/i })
    await user.clear(prompt)
    await user.type(prompt, 'hi')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    await screen.findByText(/need a bit more detail/i)

    await user.click(screen.getByRole('button', { name: /re-open: soybean crush margins/i }))
    expect(await screen.findByRole('heading', { name: /insights for/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('insight-card')).toHaveLength(10)
  })
})
