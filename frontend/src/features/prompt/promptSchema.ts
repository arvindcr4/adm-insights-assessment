import { z } from 'zod'

export const PROMPT_MAX_LENGTH = 2000

/**
 * Shape validation only. Whether a prompt is *meaningful* (length/context) is the BFF's call —
 * it answers NEEDS_CLARIFICATION and the UI relays that, so both layers stay in agreement.
 */
export function makePromptFormSchema(supportedLanguages: readonly string[]) {
  return z.object({
    prompt: z
      .string()
      .trim()
      .min(1, 'Prompt is required')
      .max(PROMPT_MAX_LENGTH, `Keep it under ${PROMPT_MAX_LENGTH} characters`),
    targetLanguage: z
      .string()
      .min(1, 'Choose a target language')
      .refine((code) => supportedLanguages.includes(code), 'Unsupported language'),
  })
}

export type PromptFormValues = z.infer<ReturnType<typeof makePromptFormSchema>>
