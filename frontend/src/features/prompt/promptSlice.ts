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

export interface PromptExchange {
  id: string
  submittedAt: number
  request: PromptRequest
  response: PromptResponse
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

function outcomeFrom(response: PromptResponse): PromptOutcome {
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
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(promptsApi.endpoints.submitPrompt.matchFulfilled, (state, action) => {
        const response = action.payload
        state.contextId = response.contextId
        state.outcome = outcomeFrom(response)
        state.history.unshift({
          id: action.meta.requestId,
          submittedAt: action.meta.fulfilledTimeStamp ?? 0,
          request: action.meta.arg.originalArgs,
          response,
        })
        if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT
      })
      .addMatcher(promptsApi.endpoints.submitPrompt.matchRejected, (state, action) => {
        if (action.meta.condition) return // request was skipped, not failed
        state.outcome = { kind: 'error', error: toAppError(action.payload ?? action.error) }
      })
  },
  selectors: {
    selectOutcome: (state) => state.outcome,
    selectContextId: (state) => state.contextId,
    selectHistory: (state) => state.history,
  },
})

export const { conversationReset, historyCleared, contextIdSet } = promptSlice.actions
export const { selectOutcome, selectContextId, selectHistory } = promptSlice.selectors
export const promptReducer = promptSlice.reducer
export const promptSliceName = promptSlice.name
