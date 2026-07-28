'use client'

import { useEffect, useRef, useState } from 'react'

import { useCampaignCellFailureChannel } from '@/components/campaign/shared/useCampaignCellFailureChannel'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

const DIRTY_MESSAGE = 'Alterações serão salvas automaticamente.'

type CampaignCellAutosavePayload = { status: string; message: string }

type SuccessPayload<TResponse> = Extract<TResponse, { status: 'success' }>

type UseCampaignCellAutosaveOptions<TValue, TResponse extends CampaignCellAutosavePayload> = {
  /** Server value. Adopted only when it changes from OUTSIDE (navigation / RSC refresh). */
  value: TValue
  /** What "unchanged" means for this shape — normalization included (see the trend's note). */
  equals: (left: TValue, right: TValue) => boolean
  endpoint: string
  buildBody: (value: TValue) => unknown
  readSaved: (payload: SuccessPayload<TResponse>) => TValue
  /** Shown when the server fails without a safe message of its own. */
  errorMessage: string
  /** Announced while a save is in flight, e.g. "Salvando tendência." */
  pendingMessage: string
}

/**
 * The auto-save machine behind the quick-edit cells (B24 tendência, B27 votos
 * estimados, B32 status de apoio): debounce, abort of a superseded request,
 * revert to the last confirmed value, and the flush that closing the overlay
 * performs.
 *
 * Four invariants it exists to hold:
 *
 * - **One value.** A field that normalizes (the trend's justificativa) keeps
 *   its raw draft string in the caller; everything else is this one value.
 * - **`flush()` is the only save path**, so blur-then-close cannot send the
 *   same payload twice.
 * - **Closing IS the commit** — hence the hook owning `open`. A caller that
 *   could close without flushing is the bug this replaces.
 * - **`valueRef` advances synchronously**, so work scheduled by an event
 *   cannot read the render that scheduled it.
 *
 * `value` may be a fresh object per render (the trend's is): the adoption
 * effect is guarded by `equals`, not by React's dependency comparison, which
 * makes a correct `equals` load-bearing for a caller passing an unstable
 * reference.
 */
export const useCampaignCellAutosave = <TValue, TResponse extends CampaignCellAutosavePayload>(
  options: UseCampaignCellAutosaveOptions<TValue, TResponse>,
) => {
  const { value: serverValue } = options
  // Effects and async work read the latest options through a ref: every
  // callback here is recreated per render, but a save started three renders ago
  // must not report through a stale one. Written during render on purpose — a
  // save started by a handler in this same commit has to see these options, and
  // rows are keyed by id, so a discarded render carries the same props anyway.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(serverValue)
  const [isDirty, setIsDirty] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const { errorMessage, setErrorMessage, reportFailure, noteOpenChange } =
    useCampaignCellFailureChannel()

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const committedRef = useRef(serverValue)
  const lastPropsRef = useRef(serverValue)
  const saveGenerationRef = useRef(0)
  /** Payload of the request in flight: blur and close flush the same one. */
  const inFlightRef = useRef<TValue | null>(null)
  /**
   * Advanced synchronously so two changes batched into one tick — or a flush
   * fired by the same event that changed the value — cannot read the render
   * that scheduled them (the bug B33+/B34 both paid for).
   */
  const valueRef = useRef(serverValue)

  const commitLocalValue = (next: TValue) => {
    valueRef.current = next
    setValue(next)
  }

  // Adopt server props only when they change from outside (navigation / RSC refresh).
  useEffect(() => {
    if (optionsRef.current.equals(serverValue, lastPropsRef.current)) return
    lastPropsRef.current = serverValue
    committedRef.current = serverValue
    valueRef.current = serverValue
    setValue(serverValue)
    setIsDirty(false)
    // `equals` is read off the ref: an inline arrow at the call site would
    // otherwise re-run this on every render.
  }, [serverValue])

  // A row unmounted mid-debounce drops the pending edit. Deliberate: there
  // would be nothing left to report a failure through.
  useEffect(
    () => () => {
      clearTimeout(saveTimeoutRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  /**
   * "Nothing left to do" means equal to what the server will END UP with, which
   * during a request is the payload in flight and not the last confirmation.
   * Comparing against `committedRef` alone silently dropped a revert: with `B`
   * in flight, going back to `A` looked settled, so nothing was sent and `B`'s
   * success then repainted the cell as `B`.
   */
  const isSettled = (next: TValue) => {
    const { equals } = optionsRef.current
    return inFlightRef.current !== null
      ? equals(next, inFlightRef.current)
      : equals(next, committedRef.current)
  }

  const save = async (next: TValue) => {
    const current = optionsRef.current
    if (isSettled(next)) return

    const generation = ++saveGenerationRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    inFlightRef.current = next

    setIsPending(true)
    setErrorMessage(null)

    const revert = () => {
      commitLocalValue(committedRef.current)
      setIsDirty(false)
    }

    try {
      const { ok, payload } = await postCampaignJson<TResponse>(
        current.endpoint,
        current.buildBody(next),
        controller.signal,
      )

      if (generation !== saveGenerationRef.current) return

      if (!ok || payload.status !== 'success') {
        revert()
        reportFailure(payload.status === 'error' ? payload.message : current.errorMessage)
        return
      }

      // Narrowed by the discriminant just above. The cast is the cheaper trade:
      // typing `readSaved` over the whole union would push a `status` re-check
      // into all three callers, which have already been told this succeeded.
      committedRef.current = current.readSaved(payload as SuccessPayload<TResponse>)
      commitLocalValue(committedRef.current)
      setIsDirty(false)
    } catch {
      if (controller.signal.aborted || generation !== saveGenerationRef.current) return
      revert()
      reportFailure(current.errorMessage)
    } finally {
      if (generation === saveGenerationRef.current) {
        inFlightRef.current = null
        setIsPending(false)
      }
    }
  }

  /**
   * Applies the value locally and schedules the save; a value already settled
   * cancels it. Takes an updater when the next value depends on the current
   * one — two controls in the same tick (a select plus a keystroke) must not
   * each build their payload from the render that scheduled them.
   */
  const change = (next: TValue | ((current: TValue) => TValue), delayMs: number) => {
    const resolved =
      typeof next === 'function' ? (next as (current: TValue) => TValue)(valueRef.current) : next

    commitLocalValue(resolved)
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = undefined
    // Editing is what clears a past failure: leaving it set would keep it above
    // `isPending`/`isDirty` in `statusMessage`, announcing the old error over
    // everything typed next.
    setErrorMessage(null)

    if (isSettled(resolved)) {
      setIsDirty(false)
      return
    }

    setIsDirty(true)
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = undefined
      void save(resolved)
    }, delayMs)
  }

  /** Sends a pending change now instead of waiting out the debounce. Idempotent. */
  const flush = () => {
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = undefined
    void save(valueRef.current)
    setIsDirty(false)
  }

  const onOpenChange = (nextOpen: boolean) => {
    noteOpenChange(nextOpen)
    if (nextOpen) {
      setIsDirty(false)
      setErrorMessage(null)
    } else if (open) {
      flush()
    }
    setOpen(nextOpen)
  }

  const statusMessage = errorMessage
    ? errorMessage
    : isPending
      ? options.pendingMessage
      : isDirty
        ? DIRTY_MESSAGE
        : ''

  return { open, onOpenChange, value, change, flush, isPending, errorMessage, statusMessage }
}
