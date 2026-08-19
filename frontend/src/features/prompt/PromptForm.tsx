import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Button, Field } from '@/components/ui'
import { localeChanged, useT } from '@/i18n'
import { FALLBACK_LANGUAGES, useGetLanguagesQuery, useSubmitPromptMutation } from '@/services/api'
import styles from './PromptForm.module.css'
import { selectContextId } from './promptSlice'
import { makePromptFormSchema, PROMPT_MAX_LENGTH, type PromptFormValues } from './promptSchema'

const DEFAULT_LANGUAGE = 'en'

/**
 * Collects prompt + target language, validates with zod, submits via RTK Query.
 * The selected target language also drives the UI locale (localeSlice).
 * It does not render responses: the outcome lives in global state (promptSlice) and is rendered
 * by <PromptOutcome/>, so this component only re-renders for form and mutation state.
 */
export function PromptForm() {
  const t = useT()
  const dispatch = useAppDispatch()
  const { data: languages = FALLBACK_LANGUAGES, isError: languagesUnavailable } =
    useGetLanguagesQuery()
  const contextId = useAppSelector(selectContextId)
  const [submitPrompt, { isLoading }] = useSubmitPromptMutation()

  const languageCodes = useMemo(() => languages.map((l) => l.code), [languages])
  const schema = useMemo(() => makePromptFormSchema(languageCodes, t), [languageCodes, t])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isValid, isDirty },
  } = useForm<PromptFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { prompt: '', targetLanguage: DEFAULT_LANGUAGE },
  })

  const promptLength = watch('prompt').length
  const targetLanguage = watch('targetLanguage')

  // The whole UI follows the selected target language.
  useEffect(() => {
    dispatch(localeChanged(targetLanguage))
  }, [dispatch, targetLanguage])

  // Re-run validation when the locale changes so messages are shown in the new language.
  useEffect(() => {
    if (isDirty) void trigger()
  }, [schema, trigger, isDirty])

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
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label={t('form.prompt')}>
      <Field
        id="prompt"
        label={t('form.prompt')}
        error={errors.prompt?.message}
        hint={`${promptLength}/${PROMPT_MAX_LENGTH}`}
      >
        <textarea
          id="prompt"
          className={styles.textarea}
          rows={3}
          placeholder={t('form.promptPlaceholder')}
          aria-invalid={errors.prompt ? true : undefined}
          aria-describedby={errors.prompt ? 'prompt-error' : 'prompt-hint'}
          {...register('prompt')}
        />
      </Field>

      <div className={styles.row}>
        <Field
          id="targetLanguage"
          label={t('form.targetLanguage')}
          error={errors.targetLanguage?.message}
          hint={languagesUnavailable ? t('form.languagesUnavailable') : undefined}
        >
          <select
            id="targetLanguage"
            className={styles.select}
            aria-invalid={errors.targetLanguage ? true : undefined}
            aria-describedby={
              errors.targetLanguage
                ? 'targetLanguage-error'
                : languagesUnavailable
                  ? 'targetLanguage-hint'
                  : undefined
            }
            {...register('targetLanguage')}
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code} lang={lang.code}>
                {lang.label} ({lang.code})
              </option>
            ))}
          </select>
        </Field>

        <Button type="submit" disabled={!isValid} loading={isLoading} className={styles.submit}>
          {isLoading ? t('form.submitting') : t('form.submit')}
        </Button>
      </div>

      {contextId && (
        <p className={styles.context}>
          {t('form.conversationNote', { id: contextId.slice(0, 8) })}
        </p>
      )}
    </form>
  )
}
