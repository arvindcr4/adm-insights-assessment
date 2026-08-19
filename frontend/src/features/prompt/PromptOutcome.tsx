import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Alert, Button, EmptyState, ErrorBoundary } from '@/components/ui'
import { InsightsPanel } from '@/features/insights/InsightsPanel'
import { errorTitle, useT } from '@/i18n'
import { validationIssues } from '@/services/api'
import type { AppError } from '@/services/api'
import {
  outcomeDismissed,
  selectOutcome,
  type PromptOutcome as PromptOutcomeState,
} from './promptSlice'

export function PromptOutcome() {
  const outcome = useAppSelector(selectOutcome)
  const dispatch = useAppDispatch()
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  // Move focus to the new result/alert after a submission (not on initial load/rehydration).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (outcome.kind === 'idle') return
    const target = containerRef.current?.querySelector<HTMLElement>('[data-focus-target]')
    target?.focus({ preventScroll: false })
  }, [outcome])

  // A rendering bug in one answer must not blank the page: the boundary resets per outcome.
  return (
    <div ref={containerRef}>
      <ErrorBoundary
        key={outcome.kind === 'success' ? outcome.requestId : outcome.kind}
        title={t('outcome.renderError')}
        actionLabel={t('outcome.dismiss')}
        onAction={() => dispatch(outcomeDismissed())}
      >
        <OutcomeView outcome={outcome} />
      </ErrorBoundary>
    </div>
  )
}

function OutcomeView({ outcome }: { outcome: PromptOutcomeState }) {
  const t = useT()
  switch (outcome.kind) {
    case 'idle':
      return <EmptyState title={t('outcome.idleTitle')}>{t('outcome.idleHint')}</EmptyState>
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
  const t = useT()
  return (
    <Alert tone="warning" title={t('outcome.clarificationTitle')} focusTarget>
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
  const t = useT()
  const issues = validationIssues(error)
  const title = errorTitle(t, error.code, error.message)
  return (
    <Alert
      tone="error"
      title={`${title} (${error.code}${error.status ? `, HTTP ${error.status}` : ''})`}
      focusTarget
      actions={
        <Button variant="ghost" onClick={() => dispatch(outcomeDismissed())}>
          {t('outcome.dismiss')}
        </Button>
      }
    >
      {title !== error.message && <p>{error.message}</p>}
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
