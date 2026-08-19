import type { Insight } from '@/services/api'
import type { SortDirection, SortField } from '@/features/insights/insightsViewSlice'

/** Case-insensitive match against text and metadata (category, tags, source). */
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

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** Returns a new sorted array; input is never mutated. */
export function sortInsights(
  insights: readonly Insight[],
  field: SortField,
  direction: SortDirection,
): Insight[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...insights].sort((a, b) => sign * collator.compare(a[field], b[field]))
}

export function deriveVisibleInsights(
  insights: readonly Insight[],
  term: string,
  field: SortField,
  direction: SortDirection,
): Insight[] {
  return sortInsights(filterInsights(insights, term), field, direction)
}
