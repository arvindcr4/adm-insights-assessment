import { baseApi } from './baseApi'
import { insightsApi } from './insightsApi'
import type { PromptRequest, PromptResponse } from './types'

export const promptsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    submitPrompt: build.mutation<PromptResponse, PromptRequest>({
      query: (body) => ({ url: 'prompts', method: 'POST', body }),
      // No auto-retry: a retry would start a new conversation turn.
      extraOptions: { maxRetries: 0 },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data.status !== 'SUCCESS') return
          // The POST already carries page 1; seed the page cache so it is not fetched again.
          const { requestId, insights, pagination } = data
          dispatch(
            insightsApi.util.upsertQueryData(
              'getInsightsPages',
              { requestId },
              { pages: [{ requestId, insights, pagination }], pageParams: [pagination.page] },
            ),
          )
        } catch {
          // handled by promptSlice matchers
        }
      },
    }),
  }),
})

export const { useSubmitPromptMutation } = promptsApi
