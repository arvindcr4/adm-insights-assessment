import { memo, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Badge, Button } from '@/components/ui'
import styles from './ConversationHistory.module.css'
import {
  historyCleared,
  historyEntryActivated,
  selectHistory,
  type PromptExchange,
} from './promptSlice'

/** Request/response pairs kept in global state; clicking one re-opens that answer. */
export function ConversationHistory() {
  const history = useAppSelector(selectHistory)
  const dispatch = useAppDispatch()
  const onActivate = useCallback((id: string) => dispatch(historyEntryActivated(id)), [dispatch])
  if (history.length === 0) return null

  return (
    <section className={styles.history} aria-label="Conversation history">
      <header className={styles.header}>
        <h2 className={styles.title}>History</h2>
        <Button variant="ghost" onClick={() => dispatch(historyCleared())}>
          Clear
        </Button>
      </header>
      <ol className={styles.list}>
        {history.map((item) => (
          <HistoryRow key={item.id} item={item} onActivate={onActivate} />
        ))}
      </ol>
    </section>
  )
}

function summarise(response: PromptExchange['response']): {
  label: string
  tone: 'accent' | 'neutral'
} {
  switch (response.status) {
    case 'SUCCESS':
      return { label: `${response.pagination.totalItems} insights`, tone: 'accent' }
    case 'NEEDS_CLARIFICATION':
      return { label: 'needs clarification', tone: 'neutral' }
    case 'ERROR':
      return { label: response.error.code, tone: 'neutral' }
  }
}

const HistoryRow = memo(function HistoryRow({
  item,
  onActivate,
}: {
  item: PromptExchange
  onActivate: (id: string) => void
}) {
  const { request, response } = item
  const summary = summarise(response)
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        onClick={() => onActivate(item.id)}
        aria-label={`Re-open: ${request.prompt} (${summary.label})`}
        title="Re-open this answer"
      >
        <span className={styles.prompt}>{request.prompt}</span>
        <Badge>{request.targetLanguage}</Badge>
        <Badge tone={summary.tone}>{summary.label}</Badge>
      </button>
    </li>
  )
})
