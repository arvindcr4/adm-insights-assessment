import { memo, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Badge, Button } from '@/components/ui'
import { useT, type Translate } from '@/i18n'
import styles from './ConversationHistory.module.css'
import {
  historyCleared,
  historyEntryActivated,
  selectHistory,
  type PromptExchange,
} from './promptSlice'

export function ConversationHistory() {
  const history = useAppSelector(selectHistory)
  const dispatch = useAppDispatch()
  const t = useT()
  const onActivate = useCallback((id: string) => dispatch(historyEntryActivated(id)), [dispatch])
  if (history.length === 0) return null

  return (
    <section className={styles.history} aria-label={t('history.region')}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('history.title')}</h2>
        <Button variant="ghost" onClick={() => dispatch(historyCleared())}>
          {t('history.clear')}
        </Button>
      </header>
      <ol className={styles.list}>
        {history.map((item) => (
          <HistoryRow key={item.id} item={item} onActivate={onActivate} t={t} />
        ))}
      </ol>
    </section>
  )
}

function summarise(
  response: PromptExchange['response'],
  t: Translate,
): { label: string; tone: 'accent' | 'neutral' } {
  switch (response.status) {
    case 'SUCCESS':
      return {
        label: t('history.insights', { count: response.pagination.totalItems }),
        tone: 'accent',
      }
    case 'NEEDS_CLARIFICATION':
      return { label: t('history.needsClarification'), tone: 'neutral' }
    case 'ERROR':
      return { label: response.error.code, tone: 'neutral' }
  }
}

const HistoryRow = memo(function HistoryRow({
  item,
  onActivate,
  t,
}: {
  item: PromptExchange
  onActivate: (id: string) => void
  t: Translate
}) {
  const { request, response } = item
  const summary = summarise(response, t)
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        onClick={() => onActivate(item.id)}
        aria-label={t('history.reopen', { prompt: request.prompt, summary: summary.label })}
        title={t('history.reopenTitle')}
      >
        <span className={styles.prompt}>{request.prompt}</span>
        <Badge>{request.targetLanguage}</Badge>
        <Badge tone={summary.tone}>{summary.label}</Badge>
      </button>
    </li>
  )
})
