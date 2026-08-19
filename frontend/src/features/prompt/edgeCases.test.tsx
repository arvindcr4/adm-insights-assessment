import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeInsight } from '@/test/fixtures'
import { renderWithStore } from '@/test/render'
import { API, server } from '@/test/server'
import { http, HttpResponse } from 'msw'
import { InsightCard } from '@/features/insights/InsightCard'
import { ErrorBoundary } from '@/components/ui'
import { ConversationHistory } from './ConversationHistory'
import { PromptForm } from './PromptForm'
import { PromptOutcome } from './PromptOutcome'
import { PROMPT_MAX_LENGTH } from './promptSchema'

function Page() {
  return (
    <>
      <PromptForm />
      <PromptOutcome />
      <ConversationHistory />
    </>
  )
}

describe('UI edge cases', () => {
  it('whitespace-only prompt is invalid', async () => {
    const user = userEvent.setup()
    renderWithStore(<PromptForm />)
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), '    ')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /get insights/i })).toBeDisabled(),
    )
    expect(await screen.findByText('Prompt is required')).toBeInTheDocument()
  })

  it('keeps the character counter visible (and flagged) when over the limit', async () => {
    const user = userEvent.setup()
    renderWithStore(<PromptForm />)
    const box = screen.getByRole('textbox', { name: 'Prompt' })
    await user.click(box)
    await user.paste('x'.repeat(PROMPT_MAX_LENGTH + 1))
    expect(
      await screen.findByText(`Keep it under ${PROMPT_MAX_LENGTH} characters`),
    ).toBeInTheDocument()
    const counter = screen.getByText(`${PROMPT_MAX_LENGTH + 1}/${PROMPT_MAX_LENGTH}`)
    expect(counter).toBeInTheDocument()
    expect(counter.className).toMatch(/error/)
    expect(screen.getByRole('button', { name: /get insights/i })).toBeDisabled()
  })

  it('Ctrl/Cmd+Enter submits; plain Enter does not', async () => {
    const user = userEvent.setup()
    renderWithStore(<Page />)
    const box = screen.getByRole('textbox', { name: 'Prompt' })
    await user.type(box, 'soybean crush margins{Enter}')
    expect(screen.queryByRole('heading', { name: /insights for/i })).not.toBeInTheDocument()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(await screen.findByRole('heading', { name: /insights for/i })).toBeInTheDocument()
  })

  it('Dismiss clears only the error; history and conversation survive', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<Page />)
    const box = screen.getByRole('textbox', { name: 'Prompt' })
    await user.type(box, 'soybean crush margins')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    await screen.findByRole('heading', { name: /insights for/i })
    const contextId = store.getState().prompt.contextId

    server.use(
      http.post(API('/prompts'), () =>
        HttpResponse.json({ error: 'INVALID_LANGUAGE', message: 'nope' }, { status: 400 }),
      ),
    )
    await user.clear(box)
    await user.type(box, 'hello world')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Dismiss' }))

    expect(screen.getByText('Ask something to get started')).toBeInTheDocument()
    expect(store.getState().prompt.history).toHaveLength(2)
    expect(store.getState().prompt.contextId).toBe(contextId)
  })

  it('"Start a new conversation" drops the context id but keeps history', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<Page />)
    await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'soybean crush margins')
    await user.click(screen.getByRole('button', { name: /get insights/i }))
    await screen.findByRole('heading', { name: /insights for/i })
    await user.click(screen.getByRole('button', { name: /start a new conversation/i }))
    expect(store.getState().prompt.contextId).toBeNull()
    expect(store.getState().prompt.history).toHaveLength(1)
    expect(screen.getByText('Ask something to get started')).toBeInTheDocument()
  })

  it('an invalid publishedAt does not crash the card', () => {
    const insight = makeInsight(1, {
      metadata: { ...makeInsight(1).metadata, publishedAt: 'not-a-date' },
    })
    renderWithStore(
      <ul>
        <InsightCard insight={insight} />
      </ul>,
    )
    expect(screen.getByText(/not-a-date/)).toBeInTheDocument()
  })

  it('a render error inside the outcome is contained by the boundary', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => {
      throw new Error('kaboom')
    }
    const onAction = vi.fn()
    renderWithStore(
      <ErrorBoundary title="Something went wrong" actionLabel="Dismiss" onAction={onAction}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    spy.mockRestore()
  })
})
