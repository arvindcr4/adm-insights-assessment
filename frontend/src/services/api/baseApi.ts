import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15_000)
export const DEFAULT_MAX_RETRIES = 2
const RETRY_BASE_MS = Number(import.meta.env.VITE_API_RETRY_BASE_MS ?? 300)

const TRANSIENT_STATUSES = new Set([502, 503, 504])

export function isTransientError(error: FetchBaseQueryError): boolean {
  if (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR') return true
  if (typeof error.status === 'number') return TRANSIENT_STATUSES.has(error.status)
  if (error.status === 'PARSING_ERROR') return TRANSIENT_STATUSES.has(error.originalStatus)
  return false
}

const baseQuery = retry(fetchBaseQuery({ baseUrl: API_BASE_URL, timeout: API_TIMEOUT_MS }), {
  // Endpoints opt out with extraOptions.maxRetries = 0.
  retryCondition: (error, _args, { attempt, extraOptions }) => {
    const max =
      (extraOptions as { maxRetries?: number } | undefined)?.maxRetries ?? DEFAULT_MAX_RETRIES
    return attempt <= max && isTransientError(error as FetchBaseQueryError)
  },
  backoff: async (attempt) => {
    const delay = RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1) * (0.8 + Math.random() * 0.4)
    await new Promise((resolve) => setTimeout(resolve, delay))
  },
})

// Endpoints are injected per feature (promptsApi, insightsApi, languagesApi).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Languages'],
  endpoints: () => ({}),
})
