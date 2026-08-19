import { useCallback, useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { Alert, Badge, Button } from '@/components/ui'
import { deriveVisibleInsights } from '@/lib/insightFilters'
import { toAppError, useGetInsightsPagesInfiniteQuery } from '@/services/api'
import { InsightList } from './InsightList'
import styles from './InsightsPanel.module.css'
import { InsightsToolbar } from './InsightsToolbar'
import { selectInsightsView } from './insightsViewSlice'
import { LoadMoreBar } from './LoadMoreBar'

interface InsightsPanelProps {
  requestId: string
  prompt: string
  targetLanguage: string
  turn: number
  matchedKeywords: string[]
}

const EMPTY: never[] = []

/**
 * Owns data fetching (infinite query) and derives the visible list from
 * loaded pages + view state (search/sort). Children are memoised so typing in the search box
 * or loading another page only re-renders what actually changed.
 */
export function InsightsPanel({
  requestId,
  prompt,
  targetLanguage,
  turn,
  matchedKeywords,
}: InsightsPanelProps) {
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useGetInsightsPagesInfiniteQuery({ requestId })
  const { searchTerm, sortField, sortDirection } = useAppSelector(selectInsightsView)

  const loaded = useMemo(() => data?.pages.flatMap((p) => p.insights) ?? EMPTY, [data])
  const visible = useMemo(
    () => deriveVisibleInsights(loaded, searchTerm, sortField, sortDirection),
    [loaded, searchTerm, sortField, sortDirection],
  )
  const pagination = data?.pages.at(-1)?.pagination

  const onLoadMore = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  if (error && !data) {
    const appError = toAppError(error)
    return (
      <Alert
        tone="error"
        title={`${appError.message} (${appError.code})`}
        actions={
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <section className={styles.panel} aria-label="Insights" aria-busy={isFetching || undefined}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Insights for “{prompt}”</h2>
          <p className={styles.meta}>
            <Badge tone="accent">{targetLanguage}</Badge> <Badge>turn {turn}</Badge>{' '}
            {matchedKeywords.length > 0 && (
              <span>
                matched:{' '}
                {matchedKeywords.map((k) => (
                  <code key={k}>{k} </code>
                ))}
              </span>
            )}
          </p>
        </div>
        {pagination && (
          <p className={styles.count} aria-live="polite">
            Showing <strong>{visible.length}</strong> of {loaded.length} loaded ·{' '}
            {pagination.totalItems} total
          </p>
        )}
      </header>

      <InsightsToolbar />

      <InsightList insights={visible} loading={isLoading} searchTerm={searchTerm} />

      {error && data && (
        <Alert tone="error" title={`Could not load more: ${toAppError(error).message}`} />
      )}

      {pagination && (
        <LoadMoreBar
          pagination={pagination}
          loadedCount={loaded.length}
          hasNextPage={hasNextPage}
          loading={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      )}
    </section>
  )
}
