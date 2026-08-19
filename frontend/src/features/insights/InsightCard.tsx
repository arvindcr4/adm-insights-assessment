import { memo } from 'react'
import { Badge } from '@/components/ui'
import { getFormatters, useLocale, useT } from '@/i18n'
import type { Insight } from '@/services/api'
import styles from './InsightCard.module.css'

export const InsightCard = memo(function InsightCard({ insight }: { insight: Insight }) {
  const t = useT()
  const { date, percent } = getFormatters(useLocale())
  const { title, content, metadata, language } = insight
  const confidence = percent.format(metadata.confidence)
  const published = new Date(metadata.publishedAt)
  const publishedLabel = Number.isNaN(published.getTime())
    ? metadata.publishedAt
    : date.format(published)
  return (
    <article className={styles.card} data-testid="insight-card" lang={language}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <span
          className={styles.confidence}
          title={t('insights.confidence', { value: confidence })}
          aria-label={t('insights.confidence', { value: confidence })}
        >
          {confidence}
        </span>
      </div>
      <p className={styles.content}>{content}</p>
      <div className={styles.meta}>
        <Badge tone="accent">{metadata.category}</Badge>
        {metadata.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        <span className={styles.muted}>
          {metadata.source} · {publishedLabel} · {language}
        </span>
      </div>
    </article>
  )
})
