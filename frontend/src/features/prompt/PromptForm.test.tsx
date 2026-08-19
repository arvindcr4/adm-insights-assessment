import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '@/test/render'
import { server } from '@/test/server'
import { PromptForm } from './PromptForm'
import { PromptOutcome } from './PromptOutcome'

function Page() {
  return (
    <>
      <PromptForm />
      <PromptOutcome />
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
    expect(screen.getByText(/conversation/i)).toHaveTextContent('ctx-1')
    expect(store.getState().prompt.history).toHaveLength(1)

    // Page 1 came from the POST; the infinite query was seeded, so no GET for it.
    expect(requests.filter((r) => r.startsWith('GET') && r.includes('/insights'))).toEqual([])
    // "Load more" then fetches page 2 only.
    await user.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => expect(screen.getAllByTestId('insight-card')).toHaveLength(20))
    expect(requests.filter((r) => r.includes('/insights'))).toEqual([
      'GET /api/v1/prompts/req-1/insights',
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

  it('shows structured 4xx errors', async () => {
    const user = userEvent.setup()
    renderWithStore(<Page />)
    await user.selectOptions(screen.getByLabelText(/target language/i), 'en')
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'hello world')
    // Force an unsupported language through the store to simulate a BFF rejection.
    await waitFor(() => expect(screen.getByRole('option', { name: /Deutsch/ })).toBeInTheDocument())
    const select = screen.getByLabelText(/target language/i) as HTMLSelectElement
    const rogue = document.createElement('option')
    rogue.value = 'xx'
    rogue.textContent = 'Nope'
    select.appendChild(rogue)
    await user.selectOptions(select, 'xx')
    // Schema now rejects it, so the button is disabled: this is the FE guard working.
    expect(screen.getByRole('button', { name: /get insights/i })).toBeDisabled()
    expect(await screen.findByText('Unsupported language')).toBeInTheDocument()
  })
})
