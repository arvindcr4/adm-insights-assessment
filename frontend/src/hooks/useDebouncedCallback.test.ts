import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedCallback } from './useDebouncedCallback'

describe('useDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('invokes only the last call after the delay', () => {
    const spy = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(spy, 300))
    act(() => {
      result.current('a')
      result.current('ab')
      result.current('abc')
    })
    expect(spy).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(299))
    expect(spy).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('abc')
  })

  it('cancel() drops the pending call and unmount cleans up', () => {
    const spy = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedCallback(spy, 100))
    act(() => result.current('x'))
    act(() => result.current.cancel())
    act(() => vi.advanceTimersByTime(200))
    expect(spy).not.toHaveBeenCalled()
    act(() => result.current('y'))
    unmount()
    act(() => vi.advanceTimersByTime(200))
    expect(spy).not.toHaveBeenCalled()
  })

  it('flush() runs the pending call immediately and keeps a stable identity', () => {
    const spy = vi.fn()
    const { result, rerender } = renderHook(() => useDebouncedCallback(spy, 100))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    act(() => result.current('now'))
    act(() => result.current.flush())
    expect(spy).toHaveBeenCalledWith('now')
  })
})
