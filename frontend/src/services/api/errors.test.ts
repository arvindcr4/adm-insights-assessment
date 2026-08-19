import { describe, expect, it } from 'vitest'
import { toAppError, validationIssues } from './errors'

describe('toAppError', () => {
  it('keeps the structured BFF body', () => {
    const err = toAppError({
      status: 400,
      data: {
        error: 'INVALID_LANGUAGE',
        message: 'Target language is not supported',
        details: { supportedLanguages: ['en'] },
      },
    })
    expect(err).toEqual({
      code: 'INVALID_LANGUAGE',
      message: 'Target language is not supported',
      status: 400,
      details: { supportedLanguages: ['en'] },
    })
  })
  it('maps fetch failures to a network error', () => {
    expect(toAppError({ status: 'FETCH_ERROR', error: 'TypeError: failed' }).code).toBe(
      'NETWORK_ERROR',
    )
  })
  it('falls back for non-structured HTTP bodies and undefined', () => {
    expect(toAppError({ status: 502, data: 'Bad gateway' })).toMatchObject({
      code: 'HTTP_502',
      status: 502,
    })
    expect(toAppError(undefined).code).toBe('UNKNOWN_ERROR')
  })
  it('extracts validation issues only when details is an issue list', () => {
    const err = toAppError({
      status: 422,
      data: {
        error: 'VALIDATION_ERROR',
        message: 'x',
        details: [{ field: 'prompt', code: 'missing', message: 'Field required' }],
      },
    })
    expect(validationIssues(err)).toHaveLength(1)
    expect(validationIssues({ code: 'X', message: 'y', details: { nope: 1 } })).toEqual([])
  })
})
