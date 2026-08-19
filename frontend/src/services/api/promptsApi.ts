import { baseApi } from './baseApi'
import { insightsApi } from './insightsApi'
import type { PromptRequest, PromptResponse } from './types'

export const promptsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    submitPrompt: build.mutation<PromptResponse, PromptRequest>({
      query: (body) => ({ url: 'prompts', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data.status !== 'SUCCESS') return
          // The POST already carries page 1; seed the infinite-query cache so the results panel
          // renders instantly and "Load more" starts from page 2 without re-fetching page 1.
          const { requestId, insights, pagination } = data
          dispatch(
            insightsApi.util.upsertQueryData(
              'getInsightsPages',
              { requestId },
              { pages: [{ requestId, insights, pagination }], pageParams: [pagination.page] },
            ),
          )
        } catch {
          // Error state is handled by the caller / promptSlice matcher.
        }
      },
    }),
  }),
})

export const { useSubmitPromptMutation } = promptsApi
