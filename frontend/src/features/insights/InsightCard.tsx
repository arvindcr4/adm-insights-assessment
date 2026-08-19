import { memo } from 'react'
import { Badge } from '@/components/ui'
import type { Insight } from '@/services/api'
import styles from './InsightCard.module.css'

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })

/** Memoised by insight identity: filtering/sorting/paginating the list never re-renders unchanged cards. */
export const InsightCard = memo(function InsightCard({ insight }: { insight: Insight }) {
  const { title, content, metadata, language } = insight
  return (
    <li className={styles.card} data-testid="insight-card">
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.confidence} title="Model confidence">
          {percent.format(metadata.confidence)}
        </span>
      </div>
      <p className={styles.content}>{content}</p>
      <div className={styles.meta}>
        <Badge tone="accent">{metadata.category}</Badge>
        {metadata.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        <span className={styles.muted}>
          {metadata.source} · {dateFormatter.format(new Date(metadata.publishedAt))} · {language}
        </span>
      </div>
    </li>
  )
})
