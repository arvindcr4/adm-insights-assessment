import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'
import type { ApiErrorBody } from './types'

/** Normalised, serialisable error the UI renders. */
export interface AppError {
  code: string
  message: string
  status?: number
  details?: unknown
}

export interface ValidationIssue {
  field: string
  code: string
  message: string
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiErrorBody).error === 'string' &&
    typeof (value as ApiErrorBody).message === 'string'
  )
}

/** Collapse RTK Query's error union into one shape, preserving the BFF's structured body. */
export function toAppError(error: FetchBaseQueryError | SerializedError | undefined): AppError {
  if (!error) return { code: 'UNKNOWN_ERROR', message: 'Something went wrong' }

  if ('status' in error) {
    if (typeof error.status === 'number') {
      if (isApiErrorBody(error.data)) {
        const { error: code, message, details } = error.data
        return {
          code,
          message,
          status: error.status,
          ...(details !== undefined ? { details } : {}),
        }
      }
      return {
        code: `HTTP_${error.status}`,
        message: `Request failed (${error.status})`,
        status: error.status,
      }
    }
    if (error.status === 'FETCH_ERROR') {
      return { code: 'NETWORK_ERROR', message: 'Could not reach the server. Is the API running?' }
    }
    if (error.status === 'TIMEOUT_ERROR') {
      return { code: 'TIMEOUT', message: 'The request timed out' }
    }
    if (error.status === 'PARSING_ERROR') {
      return {
        code: 'PARSING_ERROR',
        message: 'Unexpected response from the server',
        status: error.originalStatus,
      }
    }
    return { code: 'CUSTOM_ERROR', message: error.error }
  }

  return { code: error.code ?? 'UNKNOWN_ERROR', message: error.message ?? 'Something went wrong' }
}

export function validationIssues(error: AppError): ValidationIssue[] {
  if (!Array.isArray(error.details)) return []
  return error.details.filter(
    (d): d is ValidationIssue =>
      typeof d === 'object' && d !== null && typeof (d as ValidationIssue).field === 'string',
  )
}
