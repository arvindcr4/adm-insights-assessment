import type { AppStore, RootState } from './store'

export const STORAGE_KEY = 'insights-console:v1'
const WRITE_DELAY_MS = 250

/** Slices worth surviving a refresh. RTK Query cache is not persisted (refetched on demand). */
type PersistedState = Pick<RootState, 'prompt' | 'insightsView' | 'locale'>

function pick(state: RootState): PersistedState {
  return { prompt: state.prompt, insightsView: state.insightsView, locale: state.locale }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function loadPersistedState(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): Partial<RootState> | undefined {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !isRecord(parsed.prompt) || !Array.isArray(parsed.prompt.history)) {
      return undefined
    }
    return parsed as Partial<RootState>
  } catch {
    return undefined
  }
}

/** Debounced write of the persisted slices; returns an unsubscribe. */
export function persistStore(
  store: AppStore,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): () => void {
  if (!storage) return () => {}
  let timer: ReturnType<typeof setTimeout> | null = null
  let last = pick(store.getState())
  let pending: PersistedState | null = null

  const write = (state: PersistedState) => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // quota / private mode: persistence is best effort
    }
  }
  // Debounced writes can be lost on fast navigation; flush when the page is hidden/unloaded.
  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (pending) {
      write(pending)
      pending = null
    }
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  const win = typeof window !== 'undefined' ? window : undefined
  win?.addEventListener('pagehide', flush)
  win?.document.addEventListener('visibilitychange', onVisibility)

  const unsubscribe = store.subscribe(() => {
    const next = pick(store.getState())
    if (
      next.prompt === last.prompt &&
      next.insightsView === last.insightsView &&
      next.locale === last.locale
    ) {
      return
    }
    last = next
    pending = next
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, WRITE_DELAY_MS)
  })
  return () => {
    unsubscribe()
    win?.removeEventListener('pagehide', flush)
    win?.document.removeEventListener('visibilitychange', onVisibility)
    if (timer) clearTimeout(timer)
  }
}
