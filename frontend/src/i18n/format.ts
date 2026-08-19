import type { Locale } from './localeSlice'

/** Locale-aware Intl helpers, cached per locale so memoised components stay cheap. */
export interface Formatters {
  date: Intl.DateTimeFormat
  percent: Intl.NumberFormat
  collator: Intl.Collator
}
const formatterCache = new Map<Locale, Formatters>()
export function getFormatters(locale: Locale): Formatters {
  let f = formatterCache.get(locale)
  if (!f) {
    f = {
      date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
      collator: new Intl.Collator(locale, { sensitivity: 'base', numeric: true }),
    }
    formatterCache.set(locale, f)
  }
  return f
}
