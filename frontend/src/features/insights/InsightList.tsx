import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'
import { EmptyState } from '@/components/ui'
import { useT } from '@/i18n'
import type { Insight } from '@/services/api'
import { InsightCard } from './InsightCard'
import styles from './InsightList.module.css'

interface InsightListProps {
  insights: readonly Insight[]
  loading: boolean
  searchTerm: string
}

/** Above this many loaded items the list is windowed (only visible rows are in the DOM). */
export const VIRTUALIZE_FROM = 40
const ESTIMATED_ROW_PX = 150
const ROW_GAP_PX = 12

export const InsightList = memo(function InsightList({
  insights,
  loading,
  searchTerm,
}: InsightListProps) {
  const t = useT()
  if (loading) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label={t('insights.loading')}>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className={styles.skeleton} />
        ))}
      </ul>
    )
  }
  if (insights.length === 0) {
    return (
      <EmptyState
        title={searchTerm ? t('insights.noMatch', { term: searchTerm }) : t('insights.none')}
      >
        {searchTerm ? t('insights.noMatchHint') : null}
      </EmptyState>
    )
  }
  if (insights.length >= VIRTUALIZE_FROM) return <WindowedList insights={insights} />
  return (
    <ul className={styles.list}>
      {insights.map((insight) => (
        <li key={insight.id}>
          <InsightCard insight={insight} />
        </li>
      ))}
    </ul>
  )
})

function WindowedList({ insights }: { insights: readonly Insight[] }) {
  const listRef = useRef<HTMLUListElement>(null)
  const virtualizer = useWindowVirtualizer({
    count: insights.length,
    estimateSize: () => ESTIMATED_ROW_PX,
    overscan: 6,
    gap: ROW_GAP_PX,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (index) => insights[index]!.id,
    // React 19 warns on flushSync from the measurement path; a frame of lag on scroll is fine.
    useFlushSync: false,
  })
  const rows = virtualizer.getVirtualItems()
  return (
    <ul
      ref={listRef}
      className={styles.windowed}
      style={{ height: virtualizer.getTotalSize() }}
      aria-rowcount={insights.length}
    >
      {rows.map((row) => (
        <li
          key={row.key}
          ref={virtualizer.measureElement}
          data-index={row.index}
          className={styles.windowedRow}
          style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
        >
          <InsightCard insight={insights[row.index]!} />
        </li>
      ))}
    </ul>
  )
}
