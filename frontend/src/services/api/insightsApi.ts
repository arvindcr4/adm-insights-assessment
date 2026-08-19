import { baseApi } from './baseApi'
import type { InsightsPage } from './types'

export const PAGE_SIZE = 10

export interface InsightsQueryArg {
  requestId: string
}

/**
 * Pages of insights for an answered prompt. The backend owns slicing and metadata; the client
 * accumulates pages ("Load more") and searches/sorts the loaded set locally.
 */
export const insightsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInsightsPages: build.infiniteQuery<InsightsPage, InsightsQueryArg, number>({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (lastPage) =>
          lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: `prompts/${queryArg.requestId}/insights`,
        params: { page: pageParam, pageSize: PAGE_SIZE },
      }),
    }),
  }),
})

export const { useGetInsightsPagesInfiniteQuery } = insightsApi
