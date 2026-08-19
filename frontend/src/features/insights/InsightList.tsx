import { memo } from 'react'
import { EmptyState } from '@/components/ui'
import type { Insight } from '@/services/api'
import { InsightCard } from './InsightCard'
import styles from './InsightList.module.css'

interface InsightListProps {
  insights: readonly Insight[]
  loading: boolean
  searchTerm: string
}

/** Pure presentational list; re-renders only when the visible array identity changes. */
export const InsightList = memo(function InsightList({
  insights,
  loading,
  searchTerm,
}: InsightListProps) {
  if (loading) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label="Loading insights">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className={styles.skeleton} />
        ))}
      </ul>
    )
  }
  if (insights.length === 0) {
    return (
      <EmptyState title={searchTerm ? `No insights match “${searchTerm}”` : 'No insights returned'}>
        {searchTerm ? 'Try a different search term or load more results.' : null}
      </EmptyState>
    )
  }
  return (
    <ul className={styles.list}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </ul>
  )
})
