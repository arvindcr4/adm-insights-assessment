import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable function that invokes the latest `callback` only after `delayMs` of inactivity.
 * Pending calls are cancelled on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): ((...args: Args) => void) & { cancel: () => void; flush: () => void } {
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArgs = useRef<Args | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingArgs.current = null
  }, [])

  const flush = useCallback(() => {
    if (timerRef.current === null || pendingArgs.current === null) return
    const args = pendingArgs.current
    cancel()
    callbackRef.current(...args)
  }, [cancel])

  const debounced = useCallback(
    (...args: Args) => {
      pendingArgs.current = args
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const pending = pendingArgs.current
        pendingArgs.current = null
        if (pending) callbackRef.current(...pending)
      }, delayMs)
    },
    [delayMs],
  )

  useEffect(() => cancel, [cancel])

  return Object.assign(debounced, { cancel, flush })
}
