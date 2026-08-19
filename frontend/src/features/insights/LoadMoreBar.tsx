import { memo } from 'react'
import { Button } from '@/components/ui'
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
  return (
    <div className={styles.bar}>
      <span className={styles.status}>
        Page {pagination.page} of {pagination.totalPages} · {loadedCount}/{pagination.totalItems}{' '}
        loaded
      </span>
      {hasNextPage ? (
        <Button variant="secondary" onClick={onLoadMore} loading={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      ) : (
        <span className={styles.status}>All results loaded</span>
      )}
    </div>
  )
})
