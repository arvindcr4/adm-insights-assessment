import type { Insight, InsightsPage, Pagination, SuccessResponse } from '@/services/api'

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

export function makeSuccess(
  all: Insight[],
  overrides: Partial<SuccessResponse> = {},
): SuccessResponse {
  return {
    status: 'SUCCESS',
    requestId: 'req-1',
    contextId: 'ctx-1',
    turn: 1,
    prompt: 'soybean crush margins',
    targetLanguage: 'en',
    ...paginate(all, 1, 10),
    meta: { model: 'dummy', matchedKeywords: ['soybean'], generatedAt: '2026-03-01T10:00:00Z' },
    ...overrides,
  }
}

export function makePage(all: Insight[], page: number, requestId = 'req-1'): InsightsPage {
  return { requestId, ...paginate(all, page, 10) }
}
