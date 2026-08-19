// Mocks (typed against services/api/types.ts) must validate against the BFF's OpenAPI
// (./openapi.json, exported by `make contract`; staleness-tested on the backend).
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { ALL_INSIGHTS } from './server'
import { ERRORS, LANGUAGES, makeClarification, makePage, makeSuccess } from './fixtures'
import openapi from './openapi.json'

const SPEC_ID = 'bff-openapi'
const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addSchema(openapi as object, SPEC_ID)

function expectValid(schemaName: string, value: unknown) {
  const validate = ajv.getSchema(`${SPEC_ID}#/components/schemas/${schemaName}`)
  if (!validate) throw new Error(`schema ${schemaName} missing from openapi.json`)
  const ok = validate(value)
  expect(ok, `${schemaName}: ${ajv.errorsText(validate.errors)}`).toBe(true)
}

describe('contract: UI mocks vs BFF OpenAPI', () => {
  it('SuccessResponse (POST /prompts)', () => {
    expectValid('SuccessResponse', makeSuccess(ALL_INSIGHTS))
  })
  it('ClarificationResponse (POST /prompts)', () => {
    expectValid('ClarificationResponse', makeClarification())
  })
  it('InsightsPageResponse (GET /prompts/{id}/insights)', () => {
    expectValid('InsightsPageResponse', makePage(ALL_INSIGHTS, 2))
  })
  it('LanguagesResponse (GET /languages)', () => {
    expectValid('LanguagesResponse', { languages: LANGUAGES })
  })
  it('ErrorResponse envelopes', () => {
    for (const body of Object.values(ERRORS)) expectValid('ErrorResponse', body)
  })
  it('covers every route the UI calls', () => {
    const paths = Object.keys(openapi.paths)
    for (const p of [
      '/api/v1/prompts',
      '/api/v1/prompts/{request_id}/insights',
      '/api/v1/languages',
    ]) {
      expect(paths).toContain(p)
    }
  })
  it('rejects a renamed field (sanity)', () => {
    const { requestId: _dropped, ...broken } = makeSuccess(ALL_INSIGHTS)
    const validate = ajv.getSchema(`${SPEC_ID}#/components/schemas/SuccessResponse`)!
    expect(validate({ ...broken, request_id: _dropped })).toBe(false)
  })
})
