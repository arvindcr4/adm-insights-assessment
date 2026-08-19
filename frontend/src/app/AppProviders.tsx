import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { makeStore, type AppStore } from './store'

const defaultStore = makeStore()

export function AppProviders({
  children,
  store = defaultStore,
}: {
  children: ReactNode
  store?: AppStore
}) {
  return <Provider store={store}>{children}</Provider>
}
