import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'

const errorToast = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (message: string) => errorToast(message) } }))

/**
 * B32+ F1: this state machine (debounce, coalescing, abort of a superseded
 * request, revert, and the flush that closing performs) shipped three times
 * inside three components, where only the e2e could reach it. Extracting it is
 * what makes it testable at this level — so these cases are the precondition of
 * the refactor, not decoration.
 */
type TestResponse =
  | { status: 'success'; message: string; saved: string }
  | { status: 'error'; message: string }

const ENDPOINT = '/campanha/municipios/political-trend'
const ERROR_MESSAGE = 'Não foi possível salvar. Tente novamente.'
const DELAY = 600

const jsonResponse = (payload: TestResponse, init?: { ok?: boolean }) => ({
  ok: init?.ok ?? true,
  json: async () => payload,
})

const success = (saved: string) => jsonResponse({ status: 'success', message: 'Salvo.', saved })

const renderAutosave = (value = 'inicial') =>
  renderHook(
    (props: { value: string }) =>
      useCampaignCellAutosave<string, TestResponse>({
        value: props.value,
        equals: (left, right) => left === right,
        endpoint: ENDPOINT,
        buildBody: (next) => ({ value: next }),
        readSaved: (payload) => payload.saved,
        errorMessage: ERROR_MESSAGE,
        pendingMessage: 'Salvando.',
      }),
    { initialProps: { value } },
  )

const fetchMock = vi.fn()

const requestBodies = () =>
  fetchMock.mock.calls.map((call) => JSON.parse(String(call[1].body)) as { value: string })

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(success('salvo'))
  errorToast.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useCampaignCellAutosave', () => {
  it('waits out the debounce before posting', async () => {
    const { result } = renderAutosave()

    act(() => result.current.change('editado', DELAY))

    expect(result.current.value).toBe('editado')
    expect(result.current.statusMessage).toBe('Alterações serão salvas automaticamente.')
    act(() => void vi.advanceTimersByTime(DELAY - 1))
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => void vi.advanceTimersByTime(1))
    expect(requestBodies()).toEqual([{ value: 'editado' }])
    expect(result.current.statusMessage).toBe('')
  })

  it('coalesces keystrokes into a single request', async () => {
    const { result } = renderAutosave()

    act(() => result.current.change('e', DELAY))
    act(() => void vi.advanceTimersByTime(DELAY - 50))
    act(() => result.current.change('ed', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))

    expect(requestBodies()).toEqual([{ value: 'ed' }])
  })

  it('cancels the pending save when the value returns to the committed one', async () => {
    const { result } = renderAutosave()

    act(() => result.current.change('editado', DELAY))
    act(() => result.current.change('inicial', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.statusMessage).toBe('')
  })

  it('flushes the pending change when the overlay closes instead of dropping it', async () => {
    const { result } = renderAutosave()

    act(() => result.current.onOpenChange(true))
    act(() => result.current.change('editado', DELAY))
    await act(async () => result.current.onOpenChange(false))

    expect(requestBodies()).toEqual([{ value: 'editado' }])
  })

  it('does not re-post the payload already in flight when blur and close both flush', async () => {
    let settleSave: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleSave = resolve
        }),
    )

    const { result } = renderAutosave()

    act(() => result.current.onOpenChange(true))
    act(() => result.current.change('editado', DELAY))
    // Blur flushes…
    act(() => result.current.flush())
    // …and closing flushes again before the first request has answered.
    act(() => result.current.onOpenChange(false))

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => settleSave(success('editado')))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.value).toBe('editado')
  })

  it('ignores a response overtaken by a newer save', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    fetchMock.mockResolvedValueOnce(success('segundo'))

    const { result } = renderAutosave()

    act(() => result.current.change('primeiro', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))
    act(() => result.current.change('segundo', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))

    await act(async () => resolveFirst(success('primeiro')))

    expect(result.current.value).toBe('segundo')
    expect(result.current.errorMessage).toBeNull()
  })

  it('reverts on failure and toasts only once the overlay is closed', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { status: 'error', message: 'Você não administra este município.' },
        {
          ok: false,
        },
      ),
    )

    const { result } = renderAutosave()

    act(() => result.current.onOpenChange(true))
    act(() => result.current.change('editado', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))

    expect(result.current.value).toBe('inicial')
    expect(result.current.errorMessage).toBe('Você não administra este município.')
    // Still open: the inline Alert is the closer channel.
    expect(errorToast).not.toHaveBeenCalled()

    act(() => result.current.change('outra', DELAY))
    await act(async () => result.current.onOpenChange(false))

    expect(errorToast).toHaveBeenCalledWith('Você não administra este município.')
    expect(result.current.value).toBe('inicial')
  })

  it('collapses a failure without a message of its own into the caller error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const { result } = renderAutosave()

    act(() => result.current.change('editado', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))

    expect(result.current.errorMessage).toBe(ERROR_MESSAGE)
    expect(result.current.value).toBe('inicial')
  })

  it('sends a revert issued while a different payload is in flight', async () => {
    let settleFirst: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleFirst = resolve
        }),
    )
    fetchMock.mockResolvedValueOnce(success('inicial'))

    const { result } = renderAutosave()

    act(() => result.current.change('editado', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))
    // Back to the value the server still holds, while `editado` is unanswered:
    // "settled" has to mean the payload in flight, or nothing is sent and the
    // first response repaints the cell with the value the user just undid.
    act(() => result.current.change('inicial', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))

    await act(async () => settleFirst(success('editado')))

    expect(requestBodies()).toEqual([{ value: 'editado' }, { value: 'inicial' }])
    expect(result.current.value).toBe('inicial')
  })

  it('clears a past failure as soon as the value changes again', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'error', message: 'Recusado.' }, { ok: false }),
    )

    const { result } = renderAutosave()

    act(() => result.current.onOpenChange(true))
    act(() => result.current.change('editado', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))
    expect(result.current.statusMessage).toBe('Recusado.')

    // `errorMessage` outranks everything in `statusMessage`, so leaving it set
    // would announce the old failure over every later keystroke.
    act(() => result.current.change('corrigido', DELAY))
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.statusMessage).toBe('Alterações serão salvas automaticamente.')
  })

  it('resolves an updater against the latest value, not the render that scheduled it', async () => {
    const { result } = renderAutosave()

    act(() => {
      result.current.change('a', DELAY)
      result.current.change((current) => `${current}b`, DELAY)
    })
    await act(async () => void vi.advanceTimersByTime(DELAY))

    expect(requestBodies()).toEqual([{ value: 'ab' }])
  })

  it('adopts a server value that changed from outside, without posting it back', async () => {
    const { result, rerender } = renderAutosave()

    await act(async () => rerender({ value: 'do servidor' }))

    expect(result.current.value).toBe('do servidor')
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => result.current.change('do servidor', DELAY))
    await act(async () => void vi.advanceTimersByTime(DELAY))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
