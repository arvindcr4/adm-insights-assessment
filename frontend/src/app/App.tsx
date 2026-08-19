import { ConversationHistory } from '@/features/prompt/ConversationHistory'
import { PromptForm } from '@/features/prompt/PromptForm'
import { PromptOutcome } from '@/features/prompt/PromptOutcome'
import styles from './App.module.css'

export function App() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>Insights Console</h1>
        <p className={styles.tagline}>Ask a question, review AI insights, refine when asked.</p>
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
