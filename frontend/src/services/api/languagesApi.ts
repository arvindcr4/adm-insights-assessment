import { baseApi } from './baseApi'
import type { Language, LanguagesResponse } from './types'

/** Used until the BFF answers (or if it is unreachable) so the form is never empty. */
export const FALLBACK_LANGUAGES: readonly Language[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

export const languagesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLanguages: build.query<Language[], void>({
      query: () => 'languages',
      transformResponse: (raw: LanguagesResponse) => raw.languages,
      providesTags: ['Languages'],
      keepUnusedDataFor: 60 * 60, // effectively static
    }),
  }),
})

export const { useGetLanguagesQuery } = languagesApi
