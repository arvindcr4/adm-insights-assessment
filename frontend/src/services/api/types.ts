/** Wire contracts shared with the BFF (mirrors backend/app/schemas.py). */

export interface InsightMetadata {
  category: string
  tags: string[]
  confidence: number
  source: string
  publishedAt: string
}

export interface Insight {
  id: string
  title: string
  content: string
  language: string
  metadata: InsightMetadata
}

export interface Pagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PromptRequest {
  prompt: string
  targetLanguage: string
  contextId?: string
}

export interface ResponseMeta {
  model: string
  matchedKeywords: string[]
  generatedAt: string
}

export interface SuccessResponse {
  status: 'SUCCESS'
  requestId: string
  contextId: string
  turn: number
  prompt: string
  targetLanguage: string
  insights: Insight[]
  pagination: Pagination
  meta: ResponseMeta
}

export interface ClarificationResponse {
  status: 'NEEDS_CLARIFICATION'
  contextId: string
  turn: number
  message: string
  reasons: string[]
  suggestions: string[]
}

export type PromptResponse = SuccessResponse | ClarificationResponse

export interface InsightsPage {
  requestId: string
  insights: Insight[]
  pagination: Pagination
}

export interface Language {
  code: string
  label: string
}

export interface LanguagesResponse {
  languages: Language[]
}

/** Structured error envelope every non-2xx response carries. */
export interface ApiErrorBody {
  error: string
  message: string
  details?: unknown
}
