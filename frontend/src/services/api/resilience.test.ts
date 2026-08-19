import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { API, server } from '@/test/server'
import { isTransientError } from './baseApi'
import { languagesApi } from './languagesApi'
import { promptsApi } from './promptsApi'

describe('resilience', () => {
  it('classifies transient errors', () => {
    expect(isTransientError({ status: 'FETCH_ERROR', error: 'x' })).toBe(true)
    expect(isTransientError({ status: 'TIMEOUT_ERROR', error: 'x' })).toBe(true)
    expect(isTransientError({ status: 503, data: null })).toBe(true)
    expect(
      isTransientError({ status: 'PARSING_ERROR', originalStatus: 502, data: '', error: 'x' }),
    ).toBe(true)
    expect(isTransientError({ status: 404, data: null })).toBe(false)
    expect(isTransientError({ status: 422, data: null })).toBe(false)
  })

  it('retries a query through transient 503s and succeeds', async () => {
    let calls = 0
    server.use(
      http.get(API('/languages'), () => {
        calls += 1
        if (calls < 3)
          return HttpResponse.json({ error: 'CHAOS_INJECTED', message: 'x' }, { status: 503 })
        return HttpResponse.json({ languages: [{ code: 'en', label: 'English' }] })
      }),
    )
    const store = makeStore()
    const result = await store.dispatch(languagesApi.endpoints.getLanguages.initiate())
    expect(calls).toBe(3)
    expect(result.data).toEqual([{ code: 'en', label: 'English' }])
  })

  it('gives up on a query after the retry budget and exposes the error', async () => {
    let calls = 0
    server.use(
      http.get(API('/languages'), () => {
        calls += 1
        return HttpResponse.json({ error: 'CHAOS_INJECTED', message: 'x' }, { status: 503 })
      }),
    )
    const store = makeStore()
    const result = await store.dispatch(languagesApi.endpoints.getLanguages.initiate())
    expect(calls).toBe(3) // 1 + 2 retries
    expect(result.error).toMatchObject({ status: 503 })
  })

  it('never retries the prompt submission', async () => {
    let calls = 0
    server.use(
      http.post(API('/prompts'), () => {
        calls += 1
        return HttpResponse.json({ error: 'CHAOS_INJECTED', message: 'x' }, { status: 503 })
      }),
    )
    const store = makeStore()
    await store.dispatch(
      promptsApi.endpoints.submitPrompt.initiate({
        prompt: 'soybean crush margins',
        targetLanguage: 'en',
      }),
    )
    expect(calls).toBe(1)
    expect(store.getState().prompt.outcome).toMatchObject({
      kind: 'error',
      error: { code: 'CHAOS_INJECTED', status: 503 },
    })
  })

  it('does not retry non-transient errors', async () => {
    let calls = 0
    server.use(
      http.get(API('/languages'), () => {
        calls += 1
        return HttpResponse.json({ error: 'NOT_FOUND', message: 'x' }, { status: 404 })
      }),
    )
    const store = makeStore()
    await store.dispatch(languagesApi.endpoints.getLanguages.initiate())
    expect(calls).toBe(1)
  })
})
