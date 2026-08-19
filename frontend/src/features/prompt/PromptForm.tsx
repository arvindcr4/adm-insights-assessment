import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Button, Field } from '@/components/ui'
import { localeChanged, useLocale, useT } from '@/i18n'
import { FALLBACK_LANGUAGES, useGetLanguagesQuery, useSubmitPromptMutation } from '@/services/api'
import styles from './PromptForm.module.css'
import { conversationReset, selectContextId } from './promptSlice'
import { makePromptFormSchema, PROMPT_MAX_LENGTH, type PromptFormValues } from './promptSchema'

export function PromptForm() {
  const t = useT()
  const dispatch = useAppDispatch()
  const { data: languages = FALLBACK_LANGUAGES, isError: languagesUnavailable } =
    useGetLanguagesQuery()
  const contextId = useAppSelector(selectContextId)
  const initialLocale = useLocale()
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
    defaultValues: { prompt: '', targetLanguage: initialLocale },
  })

  const promptLength = watch('prompt').length
  const targetLanguage = watch('targetLanguage')

  // Live models can take a while; say so after a few seconds instead of a silent spinner.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!isLoading) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(timer)
  }, [isLoading])

  useEffect(() => {
    dispatch(localeChanged(targetLanguage))
  }, [dispatch, targetLanguage])

  // Re-validate on locale change so messages switch language.
  useEffect(() => {
    if (isDirty) void trigger()
  }, [schema, trigger, isDirty])

  // If the server's list does not contain the current value, snap to the first supported one.
  useEffect(() => {
    if (languageCodes.length && !languageCodes.includes(targetLanguage)) {
      setValue('targetLanguage', languageCodes[0]!, { shouldValidate: true })
    }
  }, [languageCodes, targetLanguage, setValue])

  const onSubmit = handleSubmit((values) => {
    // promptSlice matchers capture the result.
    void submitPrompt({ ...values, ...(contextId ? { contextId } : {}) })
  })

  // Ctrl/Cmd+Enter submits from the textarea (Enter alone inserts a newline).
  const onPromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isValid && !isLoading) {
      e.preventDefault()
      void onSubmit()
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label={t('form.prompt')}>
      <Field
        id="prompt"
        label={t('form.prompt')}
        error={errors.prompt?.message}
        hint={`${promptLength}/${PROMPT_MAX_LENGTH}`}
        hintTone={promptLength > PROMPT_MAX_LENGTH ? 'error' : 'muted'}
      >
        <textarea
          id="prompt"
          className={styles.textarea}
          rows={3}
          placeholder={t('form.promptPlaceholder')}
          aria-invalid={errors.prompt ? true : undefined}
          aria-describedby={errors.prompt ? 'prompt-error prompt-hint' : 'prompt-hint'}
          onKeyDown={onPromptKeyDown}
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
      {slow && (
        <p className={styles.context} role="status">
          {t('form.slowHint')}
        </p>
      )}

      {contextId && (
        <p className={styles.context}>
          {t('form.conversationNote', { id: contextId.slice(0, 8) })}{' '}
          <Button variant="ghost" onClick={() => dispatch(conversationReset())}>
            {t('form.newConversation')}
          </Button>
        </p>
      )}
    </form>
  )
}
