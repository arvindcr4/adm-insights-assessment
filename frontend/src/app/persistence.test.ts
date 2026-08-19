import { describe, expect, it, vi } from 'vitest'
import { localeChanged } from '@/i18n'
import { searchTermChanged } from '@/features/insights/insightsViewSlice'
import { loadPersistedState, persistStore, STORAGE_KEY } from './persistence'
import { makeStore } from './store'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  }
}

describe('persistence', () => {
  it('writes prompt/view/locale slices (debounced) and restores them', async () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    const store = makeStore()
    const stop = persistStore(store, storage)
    store.dispatch(localeChanged('fr'))
    store.dispatch(searchTermChanged('brazil'))
    expect(storage.data.size).toBe(0) // not yet: debounced
    vi.advanceTimersByTime(300)
    expect(storage.data.has(STORAGE_KEY)).toBe(true)
    stop()
    vi.useRealTimers()

    const restored = makeStore(loadPersistedState(storage))
    expect(restored.getState().locale.locale).toBe('fr')
    expect(restored.getState().insightsView.searchTerm).toBe('brazil')
    // RTK Query cache is never persisted
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).not.toHaveProperty('api')
  })

  it('flushes a pending write on pagehide so fast navigation does not lose state', () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    const store = makeStore()
    const stop = persistStore(store, storage)
    store.dispatch(localeChanged('es'))
    expect(storage.data.size).toBe(0)
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).locale.locale).toBe('es')
    stop()
    vi.useRealTimers()
  })

  it('ignores missing, corrupt or foreign data', () => {
    expect(loadPersistedState(memoryStorage())).toBeUndefined()
    expect(loadPersistedState(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toBeUndefined()
    expect(loadPersistedState(memoryStorage({ [STORAGE_KEY]: '{"prompt": 42}' }))).toBeUndefined()
    expect(loadPersistedState(undefined)).toBeUndefined()
  })

  it('survives a storage that throws', () => {
    vi.useFakeTimers()
    const store = makeStore()
    const stop = persistStore(store, {
      setItem: () => {
        throw new Error('quota')
      },
    })
    store.dispatch(localeChanged('de'))
    expect(() => vi.advanceTimersByTime(300)).not.toThrow()
    stop()
    vi.useRealTimers()
  })
})
