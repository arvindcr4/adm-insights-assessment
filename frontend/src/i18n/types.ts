import type { en } from './messages/en'

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

export type Messages = Widen<typeof en>

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends { other: string }
      ? `${Prefix}${K}`
      : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** e.g. 'form.submit' */
export type MessageKey = Leaves<typeof en>

export type Params = Record<string, string | number>
