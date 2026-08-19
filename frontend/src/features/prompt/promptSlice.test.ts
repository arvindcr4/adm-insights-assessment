import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { insightsApi, promptsApi } from '@/services/api'
import { http, HttpResponse } from 'msw'
import { CONTEXT_ID, REQUEST_ID } from '@/test/fixtures'
import { ALL_INSIGHTS, API, server } from '@/test/server'
import { searchTermChanged, selectSearchTerm } from '@/features/insights/insightsViewSlice'
import {
  conversationReset,
  historyEntryActivated,
  selectContextId,
  selectHistory,
  selectOutcome,
} from './promptSlice'

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0))

async function submit(store: ReturnType<typeof makeStore>, prompt: string, targetLanguage = 'en') {
  await store.dispatch(promptsApi.endpoints.submitPrompt.initiate({ prompt, targetLanguage }))
  return store.getState()
}

describe('promptSlice', () => {
  it('records a success outcome, context id and history entry', async () => {
    const store = makeStore()
    const state = await submit(store, 'soybean crush margins')
    const outcome = selectOutcome(state)
    expect(outcome.kind).toBe('success')
    if (outcome.kind === 'success') {
      expect(outcome.requestId).toBe(REQUEST_ID)
      expect(outcome.totalItems).toBe(ALL_INSIGHTS.length)
    }
    expect(selectContextId(state)).toBe(CONTEXT_ID)
    expect(selectHistory(state)).toHaveLength(1)
    expect(selectHistory(state)[0]?.request.prompt).toBe('soybean crush margins')
  })

  it('seeds the insights page cache from the POST response (no page-1 refetch)', async () => {
    const store = makeStore()
    await submit(store, 'soybean crush margins')
    await flushMicrotasks()
    const cached = insightsApi.endpoints.getInsightsPages.select({ requestId: REQUEST_ID })(
      store.getState(),
    )
    expect(cached.data?.pages[0]?.insights).toHaveLength(10)
    expect(cached.data?.pageParams).toEqual([1])
  })

  it('records clarification and error outcomes', async () => {
    const store = makeStore()
    expect(selectOutcome(await submit(store, 'hi')).kind).toBe('clarification')
    const errState = await submit(store, 'hello world', 'xx')
    const outcome = selectOutcome(errState)
    expect(outcome.kind).toBe('error')
    if (outcome.kind === 'error') {
      expect(outcome.error.code).toBe('INVALID_LANGUAGE')
      expect(outcome.error.status).toBe(400)
    }
    // Both exchanges are recorded: the clarification and the 400.
    const history = selectHistory(errState)
    expect(history).toHaveLength(2)
    expect(history[0]?.response).toMatchObject({
      status: 'ERROR',
      error: { code: 'INVALID_LANGUAGE' },
    })
    expect(history[1]?.response.status).toBe('NEEDS_CLARIFICATION')
  })

  it('maps network failures to a NETWORK_ERROR outcome', async () => {
    server.use(http.post(API('/prompts'), () => HttpResponse.error()))
    const store = makeStore()
    const outcome = selectOutcome(await submit(store, 'soybean crush margins'))
    expect(outcome).toMatchObject({ kind: 'error', error: { code: 'NETWORK_ERROR' } })
  })

  it('a new answer clears the search term but keeps sort settings', async () => {
    const store = makeStore()
    store.dispatch(searchTermChanged('brazil'))
    await submit(store, 'soybean crush margins')
    expect(selectSearchTerm(store.getState())).toBe('')
    expect(store.getState().insightsView.sortField).toBe('title')
  })

  it('historyEntryActivated re-opens a past exchange', async () => {
    const store = makeStore()
    await submit(store, 'soybean crush margins')
    await submit(store, 'hi')
    expect(selectOutcome(store.getState()).kind).toBe('clarification')
    const past = selectHistory(store.getState())[1]!
    store.dispatch(historyEntryActivated(past.id))
    expect(selectOutcome(store.getState())).toMatchObject({
      kind: 'success',
      requestId: REQUEST_ID,
    })
  })

  it('conversationReset clears everything', async () => {
    const store = makeStore()
    await submit(store, 'soybean crush margins')
    store.dispatch(conversationReset())
    expect(selectOutcome(store.getState()).kind).toBe('idle')
    expect(selectContextId(store.getState())).toBeNull()
  })
})
