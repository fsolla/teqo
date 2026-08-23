import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ASYNC_SEARCH_DEBOUNCE_MS, useAsyncSearchOptions } from '@/hooks/useAsyncSearchOptions'

type TestOption = { id: number; label: string }

const renderOptions = (
  props: {
    open?: boolean
    query?: string
    isQueryReady?: (query: string) => boolean
  } = {},
) => {
  const search = vi.fn(
    async (query: string): Promise<TestOption[]> => [{ id: 1, label: `hit:${query}` }],
  )
  const view = renderHook(
    (current: { open: boolean; query: string; isQueryReady?: (query: string) => boolean }) =>
      useAsyncSearchOptions<TestOption>({
        open: current.open,
        query: current.query,
        search,
        ...(current.isQueryReady ? { isQueryReady: current.isQueryReady } : {}),
      }),
    {
      initialProps: {
        open: props.open ?? true,
        query: props.query ?? '',
        ...(props.isQueryReady ? { isQueryReady: props.isQueryReady } : {}),
      },
    },
  )
  return { search, view }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAsyncSearchOptions', () => {
  it('waits out the debounce, then searches with the trimmed query', async () => {
    const { search, view } = renderOptions({ query: '  ca  ' })

    expect(search).not.toHaveBeenCalled()
    expect(view.result.current.loading).toBe(false)

    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))

    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('ca')
    expect(view.result.current.options).toEqual([{ id: 1, label: 'hit:ca' }])
    expect(view.result.current.loading).toBe(false)
    expect(view.result.current.failed).toBe(false)
  })

  it('does not search while the dialog stays closed', async () => {
    const { search, view } = renderOptions({ open: false, query: 'cairu' })

    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))

    expect(search).not.toHaveBeenCalled()
    expect(view.result.current.options).toEqual([])
    expect(view.result.current.loading).toBe(false)
  })

  it('coalesces rapid query changes into a single search for the last query', async () => {
    const { search, view } = renderOptions({ query: 'a' })

    act(() => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS - 1))
    view.rerender({ open: true, query: 'ab' })
    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))

    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('ab')
  })

  it('resets state without searching when the query is not ready', async () => {
    const { search, view } = renderOptions({ isQueryReady: (query) => query.length >= 2 })

    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))

    expect(search).not.toHaveBeenCalled()
    expect(view.result.current.options).toEqual([])
    expect(view.result.current.loading).toBe(false)
    expect(view.result.current.failed).toBe(false)

    view.rerender({ open: true, query: 'ca', isQueryReady: (query) => query.length >= 2 })
    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))

    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('ca')
  })

  it('sets failed on a rejected search and clears loading', async () => {
    const { search, view } = renderOptions({ query: 'ca' })
    search.mockRejectedValueOnce(new Error('boom'))

    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))

    expect(view.result.current.failed).toBe(true)
    expect(view.result.current.loading).toBe(false)
    expect(view.result.current.options).toEqual([])
  })

  it('discards an out-of-order response from a superseded request', async () => {
    const { search, view } = renderOptions({ query: 'ca' })

    let resolveFirst: (options: TestOption[]) => void = () => {}
    search.mockImplementationOnce(
      () => new Promise<TestOption[]>((resolve) => (resolveFirst = resolve)),
    )
    search.mockResolvedValueOnce([{ id: 2, label: 'hit:campanha' }])

    act(() => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))
    view.rerender({ open: true, query: 'campanha' })
    await act(async () => void vi.advanceTimersByTime(ASYNC_SEARCH_DEBOUNCE_MS))
    expect(search).toHaveBeenCalledTimes(2)

    await act(async () => resolveFirst([{ id: 1, label: 'stale' }]))

    expect(view.result.current.options).toEqual([{ id: 2, label: 'hit:campanha' }])
    expect(view.result.current.loading).toBe(false)
  })
})
