import type {
  ApiErrorBody,
  ClarificationResponse,
  Insight,
  InsightsPage,
  Language,
  Pagination,
  SuccessResponse,
} from '@/services/api'

export function makeInsight(n: number, overrides: Partial<Insight> = {}): Insight {
  return {
    id: `ins-${String(n).padStart(3, '0')}`,
    title: `Insight ${String(n).padStart(2, '0')}`,
    content: `Content for insight number ${n}`,
    language: 'en',
    metadata: {
      category: n % 2 === 0 ? 'Grains' : 'Oilseeds',
      tags: n % 3 === 0 ? ['soybean', 'brazil'] : ['wheat'],
      confidence: 0.8,
      source: 'market-desk',
      publishedAt: '2026-03-01T10:00:00Z',
    },
    ...overrides,
  }
}

export function makeInsights(count: number): Insight[] {
  return Array.from({ length: count }, (_, i) => makeInsight(i + 1))
}

export function paginate(
  all: Insight[],
  page: number,
  pageSize: number,
): { insights: Insight[]; pagination: Pagination } {
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
  const start = (page - 1) * pageSize
  return {
    insights: all.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      totalItems: all.length,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}

export const REQUEST_ID = '11111111-1111-4111-8111-111111111111'
export const CONTEXT_ID = '22222222-2222-4222-8222-222222222222'

export function makeSuccess(
  all: Insight[],
  overrides: Partial<SuccessResponse> = {},
): SuccessResponse {
  return {
    status: 'SUCCESS',
    requestId: REQUEST_ID,
    contextId: CONTEXT_ID,
    turn: 1,
    prompt: 'soybean crush margins',
    targetLanguage: 'en',
    ...paginate(all, 1, 10),
    meta: { model: 'dummy', matchedKeywords: ['soybean'], generatedAt: '2026-03-01T10:00:00Z' },
    ...overrides,
  }
}

export function makePage(all: Insight[], page: number, requestId = REQUEST_ID): InsightsPage {
  return { requestId, ...paginate(all, page, 10) }
}

export const LANGUAGES: Language[] = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

export function makeClarification(
  overrides: Partial<ClarificationResponse> = {},
): ClarificationResponse {
  return {
    status: 'NEEDS_CLARIFICATION',
    contextId: CONTEXT_ID,
    turn: 1,
    message: 'Please provide more details. The prompt is too short to be understood.',
    reasons: ['PROMPT_TOO_SHORT'],
    suggestions: ['Name the subject you are interested in.'],
    ...overrides,
  }
}

export const ERRORS = {
  validation: {
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [{ field: 'prompt', code: 'missing', message: 'Field required' }],
  },
  invalidLanguage: {
    error: 'INVALID_LANGUAGE',
    message: 'Target language is not supported',
    details: { supportedLanguages: ['de', 'en', 'es', 'fr'] },
  },
  notFound: { error: 'REQUEST_NOT_FOUND', message: 'Request not found or expired' },
} satisfies Record<string, ApiErrorBody>
