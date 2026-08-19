import type { ReactNode } from 'react'
import styles from './Field.module.css'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  hintTone?: 'muted' | 'error'
  children: ReactNode
}

/** Error/hint ids are `${id}-error` / `${id}-hint` for aria-describedby. */
export function Field({ id, label, error, hint, hintTone = 'muted', children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className={hintTone === 'error' ? styles.error : styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
