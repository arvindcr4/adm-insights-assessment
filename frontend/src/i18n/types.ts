import type { en } from './messages/en'

/** A plural message picks a form via Intl.PluralRules for the `count` param. */
export interface PluralMessage {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

type Widen<T> = T extends string
  ? string
  : T extends { other: string }
    ? PluralMessage
    : { [K in keyof T]: Widen<T[K]> }

/** Shape every locale must satisfy (derived from `en`, with literal types widened). */
export type Messages = Widen<typeof en>

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends { other: string }
      ? `${Prefix}${K}`
      : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** Dot-paths of every message, e.g. 'form.submit' | 'history.insights'. */
export type MessageKey = Leaves<typeof en>

export type Params = Record<string, string | number>
