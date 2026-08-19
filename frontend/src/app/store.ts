import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { insightsViewReducer, insightsViewSliceName } from '@/features/insights/insightsViewSlice'
import { promptReducer, promptSliceName } from '@/features/prompt/promptSlice'
import { baseApi } from '@/services/api'

export const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  [promptSliceName]: promptReducer,
  [insightsViewSliceName]: insightsViewReducer,
})

export type RootState = ReturnType<typeof rootReducer>

/** Factory so tests get an isolated store with the same wiring as production. */
export function makeStore(preloadedState?: Partial<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState,
  })
  setupListeners(store.dispatch)
  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
