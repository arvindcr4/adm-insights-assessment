import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useAppSelector } from '@/app/hooks'
import { Button, Field } from '@/components/ui'
import { FALLBACK_LANGUAGES, useGetLanguagesQuery, useSubmitPromptMutation } from '@/services/api'
import styles from './PromptForm.module.css'
import { selectContextId } from './promptSlice'
import { makePromptFormSchema, PROMPT_MAX_LENGTH, type PromptFormValues } from './promptSchema'

const DEFAULT_LANGUAGE = 'en'

/**
 * Collects prompt + target language, validates with zod, submits via RTK Query.
 * It does not render responses: the outcome lives in global state (promptSlice) and is rendered
 * by <PromptOutcome/>, so this component only re-renders for form and mutation state.
 */
export function PromptForm() {
  const { data: languages = FALLBACK_LANGUAGES } = useGetLanguagesQuery()
  const contextId = useAppSelector(selectContextId)
  const [submitPrompt, { isLoading }] = useSubmitPromptMutation()

  const languageCodes = useMemo(() => languages.map((l) => l.code), [languages])
  const schema = useMemo(() => makePromptFormSchema(languageCodes), [languageCodes])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<PromptFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { prompt: '', targetLanguage: DEFAULT_LANGUAGE },
  })

  const promptLength = watch('prompt').length

  // If the language list arrives without the current default, snap to the first supported one.
  useEffect(() => {
    if (languageCodes.length && !languageCodes.includes(DEFAULT_LANGUAGE)) {
      setValue('targetLanguage', languageCodes[0]!, { shouldValidate: true })
    }
  }, [languageCodes, setValue])

  const onSubmit = handleSubmit((values) => {
    // Errors/responses are captured by promptSlice matchers; nothing to await here.
    void submitPrompt({ ...values, ...(contextId ? { contextId } : {}) })
  })

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Prompt form">
      <Field
        id="prompt"
        label="Prompt"
        error={errors.prompt?.message}
        hint={`${promptLength}/${PROMPT_MAX_LENGTH}`}
      >
        <textarea
          id="prompt"
          className={styles.textarea}
          rows={3}
          placeholder="e.g. How are soybean crush margins trending in Brazil?"
          aria-invalid={errors.prompt ? true : undefined}
          aria-describedby={errors.prompt ? 'prompt-error' : 'prompt-hint'}
          {...register('prompt')}
        />
      </Field>

      <div className={styles.row}>
        <Field id="targetLanguage" label="Target language" error={errors.targetLanguage?.message}>
          <select
            id="targetLanguage"
            className={styles.select}
            aria-invalid={errors.targetLanguage ? true : undefined}
            {...register('targetLanguage')}
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label} ({lang.code})
              </option>
            ))}
          </select>
        </Field>

        <Button type="submit" disabled={!isValid} loading={isLoading} className={styles.submit}>
          {isLoading ? 'Analysing…' : 'Get insights'}
        </Button>
      </div>

      {contextId && (
        <p className={styles.context}>
          Conversation <code>{contextId.slice(0, 8)}</code> — follow-ups are linked to it.
        </p>
      )}
    </form>
  )
}
