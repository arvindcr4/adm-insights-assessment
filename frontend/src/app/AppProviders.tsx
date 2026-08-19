import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { loadPersistedState, persistStore } from './persistence'
import { makeStore, type AppStore } from './store'

function createDefaultStore(): AppStore {
  const store = makeStore(loadPersistedState())
  persistStore(store)
  return store
}

const defaultStore = createDefaultStore()

export function AppProviders({
  children,
  store = defaultStore,
}: {
  children: ReactNode
  store?: AppStore
}) {
  return <Provider store={store}>{children}</Provider>
}
