import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useHomeSearchQuery } from '@/components/campaign/dashboard/useHomeSearchQuery'
import { HOME_SEARCH_DEBOUNCE_MS } from '@/lib/campaignHomeSearchContract'

describe('useHomeSearchQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces raw input before updating debounced and isActive', () => {
    const { result } = renderHook(() => useHomeSearchQuery())

    act(() => {
      result.current.setRaw('ca')
    })

    expect(result.current.query.debounced).toBe('')
    expect(result.current.query.isActive).toBe(false)

    act(() => {
      vi.advanceTimersByTime(HOME_SEARCH_DEBOUNCE_MS)
    })

    expect(result.current.query.debounced).toBe('ca')
    expect(result.current.query.isActive).toBe(true)
  })

  it('does not activate until trimmed debounced length meets minimum', () => {
    const { result } = renderHook(() => useHomeSearchQuery())

    act(() => {
      result.current.setRaw('a')
    })
    act(() => {
      vi.advanceTimersByTime(HOME_SEARCH_DEBOUNCE_MS)
    })

    expect(result.current.query.isActive).toBe(false)

    act(() => {
      result.current.setRaw('ab')
    })
    act(() => {
      vi.advanceTimersByTime(HOME_SEARCH_DEBOUNCE_MS)
    })

    expect(result.current.query.isActive).toBe(true)
  })

  it('trims debounced value and treats whitespace-only as inactive', () => {
    const { result } = renderHook(() => useHomeSearchQuery())

    act(() => {
      result.current.setRaw('  ca  ')
    })
    act(() => {
      vi.advanceTimersByTime(HOME_SEARCH_DEBOUNCE_MS)
    })

    expect(result.current.query.debounced).toBe('ca')
    expect(result.current.query.isActive).toBe(true)

    act(() => {
      result.current.setRaw('   ')
    })
    act(() => {
      vi.advanceTimersByTime(HOME_SEARCH_DEBOUNCE_MS)
    })

    expect(result.current.query.debounced).toBe('')
    expect(result.current.query.isActive).toBe(false)
  })

  it('clear resets raw, debounced, and debouncing state', () => {
    const { result } = renderHook(() => useHomeSearchQuery())

    act(() => {
      result.current.setRaw('cairu')
    })
    act(() => {
      vi.advanceTimersByTime(HOME_SEARCH_DEBOUNCE_MS)
    })

    expect(result.current.query.isActive).toBe(true)

    act(() => {
      result.current.clear()
    })

    expect(result.current.query.raw).toBe('')
    expect(result.current.query.debounced).toBe('')
    expect(result.current.query.isActive).toBe(false)
    expect(result.current.isDebouncing).toBe(false)
    expect(result.current.inputFocused).toBe(false)
  })

  it('uiFocused is true when input is focused without an active query', () => {
    const { result } = renderHook(() => useHomeSearchQuery())

    act(() => {
      result.current.setInputFocused(true)
    })

    expect(result.current.uiFocused).toBe(true)
    expect(result.current.query.isActive).toBe(false)
  })
})
