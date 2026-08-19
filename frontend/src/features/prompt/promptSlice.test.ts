import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { insightsApi, promptsApi } from '@/services/api'
import { http, HttpResponse } from 'msw'
import { ALL_INSIGHTS, API, server } from '@/test/server'
import { conversationReset, selectContextId, selectHistory, selectOutcome } from './promptSlice'

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
      expect(outcome.requestId).toBe('req-1')
      expect(outcome.totalItems).toBe(ALL_INSIGHTS.length)
    }
    expect(selectContextId(state)).toBe('ctx-1')
    expect(selectHistory(state)).toHaveLength(1)
    expect(selectHistory(state)[0]?.request.prompt).toBe('soybean crush margins')
  })

  it('seeds the insights page cache from the POST response (no page-1 refetch)', async () => {
    const store = makeStore()
    await submit(store, 'soybean crush margins')
    await flushMicrotasks()
    const cached = insightsApi.endpoints.getInsightsPages.select({ requestId: 'req-1' })(
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
    // Only fulfilled exchanges are recorded: the clarification, not the 400.
    expect(selectHistory(errState)).toHaveLength(1)
  })

  it('maps network failures to a NETWORK_ERROR outcome', async () => {
    server.use(http.post(API('/prompts'), () => HttpResponse.error()))
    const store = makeStore()
    const outcome = selectOutcome(await submit(store, 'soybean crush margins'))
    expect(outcome).toMatchObject({ kind: 'error', error: { code: 'NETWORK_ERROR' } })
  })

  it('conversationReset clears everything', async () => {
    const store = makeStore()
    await submit(store, 'soybean crush margins')
    store.dispatch(conversationReset())
    expect(selectOutcome(store.getState()).kind).toBe('idle')
    expect(selectContextId(store.getState())).toBeNull()
  })
})
