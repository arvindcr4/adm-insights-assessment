import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { promptsApi } from '@/services/api'

export const SORT_FIELDS = ['title', 'content'] as const
export type SortField = (typeof SORT_FIELDS)[number]
export type SortDirection = 'asc' | 'desc'

export interface InsightsViewState {
  /** Debounced search term (the raw input value stays local to the input). */
  searchTerm: string
  sortField: SortField
  sortDirection: SortDirection
}

export const initialInsightsViewState: InsightsViewState = {
  searchTerm: '',
  sortField: 'title',
  sortDirection: 'asc',
}

const insightsViewSlice = createSlice({
  name: 'insightsView',
  initialState: initialInsightsViewState,
  reducers: {
    searchTermChanged(state, action: PayloadAction<string>) {
      state.searchTerm = action.payload
    },
    sortFieldChanged(state, action: PayloadAction<SortField>) {
      state.sortField = action.payload
    },
    sortDirectionToggled(state) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
    },
    viewReset() {
      return initialInsightsViewState
    },
  },
  extraReducers: (builder) => {
    // A new answer is a new result set: drop the search term, keep the user's sort preference.
    builder.addMatcher(promptsApi.endpoints.submitPrompt.matchFulfilled, (state) => {
      state.searchTerm = ''
    })
  },
  selectors: {
    selectSearchTerm: (state) => state.searchTerm,
    selectSortField: (state) => state.sortField,
    selectSortDirection: (state) => state.sortDirection,
    selectInsightsView: (state) => state,
  },
})

export const { searchTermChanged, sortFieldChanged, sortDirectionToggled, viewReset } =
  insightsViewSlice.actions
export const { selectSearchTerm, selectSortField, selectSortDirection, selectInsightsView } =
  insightsViewSlice.selectors
export const insightsViewReducer = insightsViewSlice.reducer
export const insightsViewSliceName = insightsViewSlice.name
