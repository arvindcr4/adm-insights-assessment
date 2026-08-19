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
  it('maps gateway failures (plain or HTML) to SERVER_UNAVAILABLE', () => {
    expect(toAppError({ status: 503, data: 'Service Unavailable' })).toMatchObject({
      code: 'SERVER_UNAVAILABLE',
      status: 503,
    })
    expect(
      toAppError({ status: 'PARSING_ERROR', originalStatus: 502, data: '<html>', error: 'x' }),
    ).toMatchObject({ code: 'SERVER_UNAVAILABLE', status: 502 })
    // A structured 503 from the app keeps its own code.
    expect(toAppError({ status: 503, data: { error: 'CHAOS_INJECTED', message: 'm' } }).code).toBe(
      'CHAOS_INJECTED',
    )
  })

  it('maps fetch failures to a network error', () => {
    expect(toAppError({ status: 'FETCH_ERROR', error: 'TypeError: failed' }).code).toBe(
      'NETWORK_ERROR',
    )
  })
  it('falls back for non-structured HTTP bodies and undefined', () => {
    expect(toAppError({ status: 500, data: 'boom' })).toMatchObject({
      code: 'HTTP_500',
      status: 500,
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
