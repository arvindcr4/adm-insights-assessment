import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { API_BASE_URL } from '@/services/api/baseApi'
import type { PromptRequest } from '@/services/api'
import {
  CONTEXT_ID,
  ERRORS,
  LANGUAGES,
  makeClarification,
  makeInsights,
  makePage,
  makeSuccess,
} from './fixtures'

export const API = (path: string) => `${API_BASE_URL}${path}`

export const ALL_INSIGHTS = makeInsights(23)

/** Default handlers mimic the real BFF closely enough for UI tests. */
export const handlers = [
  http.get(API('/languages'), () => HttpResponse.json({ languages: LANGUAGES })),
  http.post(API('/prompts'), async ({ request }) => {
    const body = (await request.json()) as PromptRequest
    if (!body.prompt?.trim()) {
      return HttpResponse.json(ERRORS.validation, { status: 422 })
    }
    if (!['en', 'es', 'fr', 'de'].includes(body.targetLanguage)) {
      return HttpResponse.json(ERRORS.invalidLanguage, { status: 400 })
    }
    if (body.prompt.trim().length < 5) {
      return HttpResponse.json(makeClarification({ contextId: body.contextId ?? CONTEXT_ID }))
    }
    return HttpResponse.json(
      makeSuccess(ALL_INSIGHTS, {
        prompt: body.prompt,
        targetLanguage: body.targetLanguage,
        contextId: body.contextId ?? CONTEXT_ID,
      }),
    )
  }),
  http.get(API('/prompts/:requestId/insights'), ({ request, params }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    return HttpResponse.json(makePage(ALL_INSIGHTS, page, String(params.requestId)))
  }),
]

export const server = setupServer(...handlers)
