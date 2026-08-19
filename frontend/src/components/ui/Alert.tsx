import type { ReactNode } from 'react'
import styles from './Alert.module.css'

type Tone = 'info' | 'warning' | 'error' | 'success'

interface AlertProps {
  tone?: Tone
  title: string
  children?: ReactNode
  actions?: ReactNode
}

export function Alert({ tone = 'info', title, children, actions }: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.content}>{children}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
