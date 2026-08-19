import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { promptsApi, toAppError } from '@/services/api'
import type { AppError, ClarificationResponse, PromptRequest, PromptResponse } from '@/services/api'

/** Exactly one outcome is shown at a time; each submission resolves into one of these. */
export type PromptOutcome =
  | { kind: 'idle' }
  | {
      kind: 'success'
      requestId: string
      prompt: string
      targetLanguage: string
      turn: number
      totalItems: number
      matchedKeywords: string[]
    }
  | { kind: 'clarification'; message: string; reasons: string[]; suggestions: string[] }
  | { kind: 'error'; error: AppError }

/** A 4xx/network failure is still a response worth keeping. */
export interface ErrorResponse {
  status: 'ERROR'
  error: AppError
}

export interface PromptExchange {
  id: string
  request: PromptRequest
  response: PromptResponse | ErrorResponse
}

export interface PromptState {
  /** Conversation id carried across submissions so the BFF can link turns. */
  contextId: string | null
  outcome: PromptOutcome
  /** Request + response pairs, newest first. */
  history: PromptExchange[]
}

export const HISTORY_LIMIT = 20

export const initialPromptState: PromptState = {
  contextId: null,
  outcome: { kind: 'idle' },
  history: [],
}

function outcomeFrom(response: PromptResponse | ErrorResponse): PromptOutcome {
  if (response.status === 'ERROR') return { kind: 'error', error: response.error }
  if (response.status === 'NEEDS_CLARIFICATION') {
    const { message, reasons, suggestions } = response as ClarificationResponse
    return { kind: 'clarification', message, reasons, suggestions }
  }
  return {
    kind: 'success',
    requestId: response.requestId,
    prompt: response.prompt,
    targetLanguage: response.targetLanguage,
    turn: response.turn,
    totalItems: response.pagination.totalItems,
    matchedKeywords: response.meta.matchedKeywords,
  }
}

const promptSlice = createSlice({
  name: 'prompt',
  initialState: initialPromptState,
  reducers: {
    conversationReset() {
      return initialPromptState
    },
    historyCleared(state) {
      state.history = []
    },
    contextIdSet(state, action: PayloadAction<string | null>) {
      state.contextId = action.payload
    },
    /** Re-open a past exchange; successful answers come straight from the RTK Query cache. */
    historyEntryActivated(state, action: PayloadAction<string>) {
      const entry = state.history.find((e) => e.id === action.payload)
      if (!entry) return
      state.outcome = outcomeFrom(entry.response)
      if (entry.response.status !== 'ERROR') state.contextId = entry.response.contextId
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(promptsApi.endpoints.submitPrompt.matchFulfilled, (state, action) => {
        const response = action.payload
        state.contextId = response.contextId
        state.outcome = outcomeFrom(response)
        state.history.unshift({
          id: action.meta.requestId,
          request: action.meta.arg.originalArgs,
          response,
        })
        if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT
      })
      .addMatcher(promptsApi.endpoints.submitPrompt.matchRejected, (state, action) => {
        if (action.meta.condition) return // request was skipped, not failed
        const error = toAppError(action.payload ?? action.error)
        state.outcome = { kind: 'error', error }
        state.history.unshift({
          id: action.meta.requestId,
          request: action.meta.arg.originalArgs,
          response: { status: 'ERROR', error },
        })
        if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT
      })
  },
  selectors: {
    selectOutcome: (state) => state.outcome,
    selectContextId: (state) => state.contextId,
    selectHistory: (state) => state.history,
  },
})

export const { conversationReset, historyCleared, contextIdSet, historyEntryActivated } =
  promptSlice.actions
export const { selectOutcome, selectContextId, selectHistory } = promptSlice.selectors
export const promptReducer = promptSlice.reducer
export const promptSliceName = promptSlice.name
