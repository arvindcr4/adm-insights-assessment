import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function toLocale(code: string): Locale {
  return isLocale(code) ? code : DEFAULT_LOCALE
}

const localeSlice = createSlice({
  name: 'locale',
  initialState: { locale: DEFAULT_LOCALE } as { locale: Locale },
  reducers: {
    localeChanged(state, action: PayloadAction<string>) {
      state.locale = toLocale(action.payload)
    },
  },
  selectors: {
    selectLocale: (state) => state.locale,
  },
})

export const { localeChanged } = localeSlice.actions
export const { selectLocale } = localeSlice.selectors
export const localeReducer = localeSlice.reducer
export const localeSliceName = localeSlice.name
