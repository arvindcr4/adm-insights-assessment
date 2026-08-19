import { z } from 'zod'
import type { Translate } from '@/i18n'

export const PROMPT_MAX_LENGTH = 2000

// Shape only. Whether a prompt is meaningful is the BFF's call (NEEDS_CLARIFICATION).
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
