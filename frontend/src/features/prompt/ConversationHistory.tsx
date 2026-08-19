import { memo } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Badge, Button } from '@/components/ui'
import styles from './ConversationHistory.module.css'
import { historyCleared, selectHistory, type PromptExchange } from './promptSlice'

/** Read-only view of the request/response pairs kept in global state. */
export function ConversationHistory() {
  const history = useAppSelector(selectHistory)
  const dispatch = useAppDispatch()
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
          <HistoryRow key={item.id} item={item} />
        ))}
      </ol>
    </section>
  )
}

const HistoryRow = memo(function HistoryRow({ item }: { item: PromptExchange }) {
  const { request, response } = item
  const summary =
    response.status === 'SUCCESS'
      ? `${response.pagination.totalItems} insights`
      : 'needs clarification'
  return (
    <li className={styles.row}>
      <span className={styles.prompt} title={request.prompt}>
        {request.prompt}
      </span>
      <Badge>{request.targetLanguage}</Badge>
      <Badge tone={response.status === 'SUCCESS' ? 'accent' : 'neutral'}>{summary}</Badge>
    </li>
  )
})
