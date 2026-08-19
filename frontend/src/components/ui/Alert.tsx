import type { ReactNode } from 'react'
import styles from './Alert.module.css'

type Tone = 'info' | 'warning' | 'error' | 'success'

interface AlertProps {
  tone?: Tone
  title: string
  children?: ReactNode
  actions?: ReactNode
  /** Programmatic focus target after a submission (see PromptOutcome). */
  focusTarget?: boolean
}

export function Alert({ tone = 'info', title, children, actions, focusTarget }: AlertProps) {
  return (
    <div
      className={`${styles.alert} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
      tabIndex={focusTarget ? -1 : undefined}
      data-focus-target={focusTarget ? '' : undefined}
    >
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.content}>{children}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
