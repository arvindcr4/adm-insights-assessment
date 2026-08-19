import { useCallback, useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { Alert, Badge, Button } from '@/components/ui'
import { errorTitle, useLocale, useT } from '@/i18n'
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

export function InsightsPanel({
  requestId,
  prompt,
  targetLanguage,
  turn,
  matchedKeywords,
}: InsightsPanelProps) {
  const t = useT()
  const locale = useLocale()
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
    () => deriveVisibleInsights(loaded, searchTerm, sortField, sortDirection, locale),
    [loaded, searchTerm, sortField, sortDirection, locale],
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
        title={`${errorTitle(t, appError.code, appError.message)} (${appError.code})`}
        actions={
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('outcome.retry')}
          </Button>
        }
      />
    )
  }

  return (
    <section
      className={styles.panel}
      aria-label={t('insights.region')}
      aria-busy={isFetching || undefined}
    >
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('insights.heading', { prompt })}</h2>
          <p className={styles.meta}>
            <Badge tone="accent">{targetLanguage}</Badge>{' '}
            <Badge>{t('insights.turn', { turn })}</Badge>{' '}
            {matchedKeywords.length > 0 && (
              <span>
                {t('insights.matched')}{' '}
                {matchedKeywords.map((k) => (
                  <code key={k}>{k} </code>
                ))}
              </span>
            )}
          </p>
        </div>
        {pagination && (
          <p className={styles.count} aria-live="polite">
            {t('insights.showing', {
              visible: visible.length,
              loaded: loaded.length,
              total: pagination.totalItems,
            })}
          </p>
        )}
      </header>

      <InsightsToolbar />

      <InsightList insights={visible} loading={isLoading} searchTerm={searchTerm} />

      {error && data && (
        <Alert
          tone="error"
          title={t('insights.loadMoreFailed', {
            message: errorTitle(t, toAppError(error).code, toAppError(error).message),
          })}
        />
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
