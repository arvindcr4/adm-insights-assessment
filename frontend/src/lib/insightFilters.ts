import type { Insight } from '@/services/api'
import type { SortDirection, SortField } from '@/features/insights/insightsViewSlice'
import { getFormatters } from '@/i18n/format'
import type { Locale } from '@/i18n/localeSlice'

export function matchesSearch(insight: Insight, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  const { title, content, metadata } = insight
  return (
    title.toLowerCase().includes(needle) ||
    content.toLowerCase().includes(needle) ||
    metadata.category.toLowerCase().includes(needle) ||
    metadata.source.toLowerCase().includes(needle) ||
    metadata.tags.some((tag) => tag.toLowerCase().includes(needle))
  )
}

export function filterInsights(insights: readonly Insight[], term: string): Insight[] {
  if (!term.trim()) return insights as Insight[]
  return insights.filter((i) => matchesSearch(i, term))
}

export function sortInsights(
  insights: readonly Insight[],
  field: SortField,
  direction: SortDirection,
  locale: Locale = 'en',
): Insight[] {
  const { collator } = getFormatters(locale)
  const sign = direction === 'asc' ? 1 : -1
  return [...insights].sort((a, b) => sign * collator.compare(a[field], b[field]))
}

export function deriveVisibleInsights(
  insights: readonly Insight[],
  term: string,
  field: SortField,
  direction: SortDirection,
  locale: Locale = 'en',
): Insight[] {
  return sortInsights(filterInsights(insights, term), field, direction, locale)
}
