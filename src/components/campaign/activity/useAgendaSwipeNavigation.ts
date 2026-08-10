'use client'

import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'

/**
 * C101 — horizontal swipe navigation for the mobile agenda. FullCalendar has
 * no swipe gesture of its own, so this hook listens for a clear horizontal
 * drag on the calendar container and maps it to prev/next navigation.
 *
 * Chromium's pan controller claims any touch drag for scrolling the moment
 * the first touchmove passes its slop — firing pointercancel and ending the
 * pointer stream (on a real swipe the first move is small, so the 48px
 * threshold would never be reached). The fix is the classic swipe-vs-scroll
 * pattern: a NON-PASSIVE touchmove listener on the container calls
 * `preventDefault` as soon as the gesture is clearly horizontal (dead zone +
 * dominance), which stops the browser from claiming it. Vertical moves get no
 * preventDefault, so the timegrid keeps scrolling natively (and the browser
 * cancels the pointer stream — the gesture then resets, which is correct).
 *
 * Contract with FullCalendar's touch interactions (FC runs on touch events,
 * this hook on pointer events, both on the same gesture):
 *
 * - Tap (inline create, C91) needs no movement: a swipe crosses the
 *   threshold and FC's own hit-equality (initialHit !== finalHit) already
 *   suppresses the dateClick.
 * - The day view has a single column, so ANY horizontal drag ends with
 *   initialHit === finalHit and FC fires a dateClick: the caller ignores
 *   clicks while `suppressDateClickRef` is set. The flag arms at the 12px
 *   claim (a sub-threshold flick must not open the inline create either)
 *   and clears on the next pointerdown — a genuine tap after a failed swipe
 *   keeps working.
 * - The event long-press (650ms, C15 reschedule) must not fire mid-swipe:
 *   on consume we dispatch a synthetic `touchcancel` at the touchstart
 *   target — browsers emit real touchcancel exactly when a gesture is taken
 *   away, and FC treats it as a touch end, clearing its pending timers.
 * - A drag FC already owns (eventDragStart/eventResizeStart fired) is
 *   blocked via `blockRef`: slow horizontal drags on events stay
 *   reschedules.
 *
 * Only touch/pen pointers navigate — mouse keeps the desktop toolbar.
 */

const AGENDA_SWIPE_THRESHOLD_PX = 48
const AGENDA_SWIPE_DOMINANCE = 1.4
/** Horizontal movement that already proves intent (pan claim dead zone). */
const AGENDA_SWIPE_CLAIM_PX = 12
/** Backstop for the dateClick suppression when no next gesture ever comes. */
const AGENDA_CLICK_SUPPRESSION_MS = 500

type AgendaSwipeDirection = 'next' | 'prev'

type AgendaSwipeGesture = {
  pointerId: number
  startX: number
  startY: number
  startTarget: EventTarget | null
  consumed: boolean
}

export const useAgendaSwipeNavigation = ({
  containerRef,
  enabled,
  blockRef,
  onSwipe,
}: {
  containerRef: RefObject<HTMLElement | null>
  /** Render-time gate (viewport/state-driven): when false, no gesture starts. */
  enabled: boolean
  /** Event-time gate: when true, an in-flight gesture is abandoned (FC drag owns the pointer). */
  blockRef: MutableRefObject<boolean>
  onSwipe: (direction: AgendaSwipeDirection) => void
}): { suppressDateClickRef: MutableRefObject<boolean> } => {
  const gestureRef = useRef<AgendaSwipeGesture | null>(null)
  const enabledRef = useRef(enabled)
  const blockRefRef = useRef(blockRef)
  const onSwipeRef = useRef(onSwipe)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * The day view has a single column, so a horizontal drag never leaves the
   * slot it started on: FullCalendar's dateClick fires (initialHit ===
   * finalHit) at the end of the gesture. The caller ignores that click —
   * the drag either navigated (consume) or was a sub-threshold flick, and
   * neither may open the inline create.
   */
  const suppressDateClickRef = useRef(false)

  enabledRef.current = enabled
  blockRefRef.current = blockRef
  onSwipeRef.current = onSwipe

  const armClickSuppression = useCallback(() => {
    suppressDateClickRef.current = true
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(() => {
      suppressTimerRef.current = null
      suppressDateClickRef.current = false
    }, AGENDA_CLICK_SUPPRESSION_MS)
  }, [])

  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (!enabledRef.current || blockRefRef.current.current) return
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    if (event.isPrimary === false) return

    // A new gesture means the previous one ended: its dateClick (if any) has
    // already fired, so a genuine tap right after a failed swipe is safe.
    suppressDateClickRef.current = false
    if (suppressTimerRef.current) {
      clearTimeout(suppressTimerRef.current)
      suppressTimerRef.current = null
    }

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTarget: event.target,
      consumed: false,
    }
  }, [])

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.consumed || blockRefRef.current.current) return
      const touch = event.touches[0]
      if (!touch) return

      const deltaX = touch.clientX - gesture.startX
      const deltaY = touch.clientY - gesture.startY
      if (
        Math.abs(deltaX) > AGENDA_SWIPE_CLAIM_PX &&
        Math.abs(deltaX) > Math.abs(deltaY) * AGENDA_SWIPE_DOMINANCE
      ) {
        // Clearly horizontal: keep the browser from claiming the gesture for
        // panning (which would pointercancel the stream before the
        // threshold) AND suppress the dateClick a sub-threshold flick would
        // otherwise trigger in the day view.
        event.preventDefault()
        armClickSuppression()
      }
    },
    [armClickSuppression],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.consumed || event.pointerId !== gesture.pointerId) return
      if (blockRefRef.current.current) {
        gestureRef.current = null
        return
      }

      const deltaX = event.clientX - gesture.startX
      const deltaY = event.clientY - gesture.startY
      if (Math.abs(deltaX) < AGENDA_SWIPE_THRESHOLD_PX) return
      if (Math.abs(deltaX) < Math.abs(deltaY) * AGENDA_SWIPE_DOMINANCE) {
        // Vertical drag (scrolling the timeline, rescheduling): never navigate.
        gesture.consumed = true
        return
      }

      gesture.consumed = true

      // Kill FullCalendar's pending long-press/tap timers FIRST: its touch
      // listeners are attached to the touchstart target, so the cancel must be
      // dispatched there while that node is still connected (synthetic
      // touchcancel = the browser taking the gesture away).
      const startTarget = gesture.startTarget
      if (typeof TouchEvent !== 'undefined' && startTarget instanceof Element) {
        startTarget.dispatchEvent(
          new TouchEvent('touchcancel', { bubbles: true, cancelable: true }),
        )
      }

      armClickSuppression()
      onSwipeRef.current(deltaX < 0 ? 'next' : 'prev')
    },
    [armClickSuppression],
  )

  const handlePointerEnd = useCallback((event: PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || event.pointerId !== gesture.pointerId) return
    gestureRef.current = null
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('pointerdown', handlePointerDown)
    // Non-passive: the horizontal-claim preventDefault must reach the browser
    // before the pan controller decides (see module doc).
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('touchmove', handleTouchMove)
    }
  }, [containerRef, handlePointerDown, handleTouchMove])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [handlePointerMove, handlePointerEnd])

  useEffect(
    () => () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    },
    [],
  )

  return { suppressDateClickRef }
}
