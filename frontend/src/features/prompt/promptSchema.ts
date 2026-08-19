import { z } from 'zod'
import type { Translate } from '@/i18n'

export const PROMPT_MAX_LENGTH = 2000

/**
 * Shape validation only. Whether a prompt is *meaningful* (length/context) is the BFF's call —
 * it answers NEEDS_CLARIFICATION and the UI relays that, so both layers stay in agreement.
 */
export function makePromptFormSchema(supportedLanguages: readonly string[], t: Translate) {
  return z.object({
    prompt: z
      .string()
      .trim()
      .min(1, t('form.errors.promptRequired'))
      .max(PROMPT_MAX_LENGTH, t('form.errors.promptTooLong', { max: PROMPT_MAX_LENGTH })),
    targetLanguage: z
      .string()
      .min(1, t('form.errors.languageRequired'))
      .refine((code) => supportedLanguages.includes(code), t('form.errors.languageUnsupported')),
  })
}

export type PromptFormValues = z.infer<ReturnType<typeof makePromptFormSchema>>
