import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Alert, Button, EmptyState } from '@/components/ui'
import { InsightsPanel } from '@/features/insights/InsightsPanel'
import { validationIssues } from '@/services/api'
import type { AppError } from '@/services/api'
import { conversationReset, selectOutcome } from './promptSlice'

/** Switches on the single source of truth for "what did the last submission produce". */
export function PromptOutcome() {
  const outcome = useAppSelector(selectOutcome)

  switch (outcome.kind) {
    case 'idle':
      return (
        <EmptyState title="Ask something to get started">
          Try “soybean crush margins in Brazil” or “wheat exports black sea”.
        </EmptyState>
      )
    case 'clarification':
      return <ClarificationNotice message={outcome.message} suggestions={outcome.suggestions} />
    case 'error':
      return <ErrorNotice error={outcome.error} />
    case 'success':
      return (
        <InsightsPanel
          key={outcome.requestId}
          requestId={outcome.requestId}
          prompt={outcome.prompt}
          targetLanguage={outcome.targetLanguage}
          turn={outcome.turn}
          matchedKeywords={outcome.matchedKeywords}
        />
      )
  }
}

function ClarificationNotice({ message, suggestions }: { message: string; suggestions: string[] }) {
  return (
    <Alert tone="warning" title="We need a bit more detail">
      <p>{message}</p>
      {suggestions.length > 0 && (
        <ul>
          {suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </Alert>
  )
}

function ErrorNotice({ error }: { error: AppError }) {
  const dispatch = useAppDispatch()
  const issues = validationIssues(error)
  return (
    <Alert
      tone="error"
      title={`${error.message} (${error.code}${error.status ? `, HTTP ${error.status}` : ''})`}
      actions={
        <Button variant="ghost" onClick={() => dispatch(conversationReset())}>
          Reset
        </Button>
      }
    >
      {issues.length > 0 && (
        <ul>
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.code}`}>
              <strong>{issue.field}</strong>: {issue.message}
            </li>
          ))}
        </ul>
      )}
      {issues.length === 0 && error.details != null && (
        <pre>{JSON.stringify(error.details, null, 2)}</pre>
      )}
    </Alert>
  )
}
