import { memo } from 'react'
import { Button } from '@/components/ui'
import { useT } from '@/i18n'
import type { Pagination } from '@/services/api'
import styles from './LoadMoreBar.module.css'

interface LoadMoreBarProps {
  pagination: Pagination
  loadedCount: number
  hasNextPage: boolean
  loading: boolean
  onLoadMore: () => void
}

export const LoadMoreBar = memo(function LoadMoreBar({
  pagination,
  loadedCount,
  hasNextPage,
  loading,
  onLoadMore,
}: LoadMoreBarProps) {
  const t = useT()
  return (
    <div className={styles.bar}>
      <span className={styles.status}>
        {t('insights.pageStatus', {
          page: pagination.page,
          pages: pagination.totalPages,
          loaded: loadedCount,
          total: pagination.totalItems,
        })}
      </span>
      {hasNextPage ? (
        <Button variant="secondary" onClick={onLoadMore} loading={loading}>
          {loading ? t('insights.loadingMore') : t('insights.loadMore')}
        </Button>
      ) : (
        <span className={styles.status}>{t('insights.allLoaded')}</span>
      )}
    </div>
  )
})
