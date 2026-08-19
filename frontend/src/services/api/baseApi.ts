import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * Single RTK Query slice. Feature-specific endpoints are injected from their own modules
 * (`promptsApi`, `insightsApi`, `languagesApi`) so API logic stays next to the feature that owns it
 * while sharing one cache/middleware.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }),
  tagTypes: ['Languages'],
  endpoints: () => ({}),
})
