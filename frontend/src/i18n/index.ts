import { useCallback } from 'react'
import { useAppSelector } from '@/app/hooks'
import { de } from './messages/de'
import { en } from './messages/en'
import { es } from './messages/es'
import { fr } from './messages/fr'
import { selectLocale, type Locale } from './localeSlice'
import type { MessageKey, Messages, Params, PluralMessage } from './types'

export { localeChanged, selectLocale, toLocale, SUPPORTED_LOCALES } from './localeSlice'
export type { Locale } from './localeSlice'
export type { MessageKey, Params } from './types'
export { getFormatters } from './format'
export type { Formatters } from './format'

const MESSAGES: Record<Locale, Messages> = { en, es, fr, de }

function lookup(messages: Messages, key: string): string | PluralMessage | undefined {
  let node: unknown = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' || (typeof node === 'object' && node !== null && 'other' in node)
    ? (node as string | PluralMessage)
    : undefined
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const message = lookup(MESSAGES[locale], key) ?? lookup(en, key)
  if (message === undefined) return key
  if (typeof message === 'string') return interpolate(message, params)
  const count = Number(params?.count ?? 0)
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRules.set(locale, rules)
  }
  const form = message[rules.select(count)] ?? message.other
  return interpolate(form, params)
}

export type Translate = (key: MessageKey, params?: Params) => string

export function useT(): Translate {
  const locale = useAppSelector(selectLocale)
  return useCallback<Translate>((key, params) => translate(locale, key, params), [locale])
}

export function useLocale(): Locale {
  return useAppSelector(selectLocale)
}

/** Localized by code when known, else the server's message. */
export function errorTitle(t: Translate, code: string, fallback: string): string {
  const key = `errors.${code}` as MessageKey
  const text = translate('en', key)
  return text === key ? fallback : t(key)
}
