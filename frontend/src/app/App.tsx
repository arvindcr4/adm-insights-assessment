import { useEffect } from 'react'
import { ConversationHistory } from '@/features/prompt/ConversationHistory'
import { PromptForm } from '@/features/prompt/PromptForm'
import { PromptOutcome } from '@/features/prompt/PromptOutcome'
import { useLocale, useT } from '@/i18n'
import styles from './App.module.css'

export function App() {
  const t = useT()
  const locale = useLocale()

  // Keep the document language in step with the UI locale (screen readers, hyphenation, fonts).
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('app.title')
  }, [locale, t])

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{t('app.title')}</h1>
        <p className={styles.tagline}>{t('app.tagline')}</p>
      </header>
      <main className={styles.main}>
        <PromptForm />
        <PromptOutcome />
      </main>
      <aside className={styles.aside}>
        <ConversationHistory />
      </aside>
    </div>
  )
}
