'use client'

import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'

/**
 * C101/C110 — horizontal swipe navigation for the mobile agenda. FullCalendar
 * has no swipe gesture of its own, so this hook listens for a clear horizontal
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
 * C110 — the gesture now gives live feedback instead of swapping mid-drag:
 *
 * - At the 12px claim the grid starts following the finger (imperative
 *   transform on the container — never React state, so FullCalendar does not
 *   re-render per frame), the adjacent period preview starts
 *   (`onSwipePreviewStart`), and a synthetic `touchcancel` is dispatched to
 *   the touchstart target — browsers emit real touchcancel exactly when a
 *   gesture is taken away, and FC treats it as a touch end, clearing its
 *   pending long-press timers. The direction is LOCKED at the claim and the
 *   transform is clamped to it (the grid never crosses its starting point).
 *   Every subsequent touchmove keeps calling `preventDefault`: the browser's
 *   pan/flick recognizers re-evaluate on each move, and one unprevented move
 *   mid-drag fires a real pointercancel (the stream dies, taking the live
 *   transform and the preview with it).
 * - The navigation decision moved to the RELEASE: `pointerup` with
 *   |dx| ≥ 48px (and still horizontal) commits — `onSwipe(direction)` — with
 *   the grid sliding the remaining distance to rest; anything below commits
 *   as a snap-back (transform reset, no navigation, `onSwipePreviewEnd`).
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
 *   the synthetic `touchcancel` at the claim kills it as soon as the gesture
 *   is ours. A reschedule still wins when the user holds still first (the
 *   long-press fires before any claim and `blockRef` then abandons the
 *   swipe). Behavior change vs C101: a slow horizontal drag (12–47px) on an
 *   event no longer falls through to FC's long-press at 650ms — by then the
 *   claim has already canceled it — it snap-backs instead. Intentional: any
 *   claimed horizontal gesture is swipe territory.
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
/** Exit animation (commit slide / snap-back), and its cleanup backstop. */
const AGENDA_SWIPE_EXIT_MS = 180

type AgendaSwipeDirection = 'next' | 'prev'

type AgendaSwipeGesture = {
  pointerId: number
  startX: number
  startY: number
  startTarget: EventTarget | null
  /** Locked at the claim; drives the preview side and the transform clamp. */
  direction: AgendaSwipeDirection | null
  lastDx: number
  lastDy: number
}

export const useAgendaSwipeNavigation = ({
  containerRef,
  enabled,
  blockRef,
  onSwipe,
  onSwipePreviewStart,
  onSwipePreviewEnd,
}: {
  containerRef: RefObject<HTMLElement | null>
  /** Render-time gate (viewport/state-driven): when false, no gesture starts. */
  enabled: boolean
  /** Event-time gate: when true, an in-flight gesture is abandoned (FC drag owns the pointer). */
  blockRef: MutableRefObject<boolean>
  /** C110 — fired only when the release COMMITS (|dx| ≥ threshold, horizontal). */
  onSwipe: (direction: AgendaSwipeDirection) => void
  /** C110 — the adjacent-period preview opens (claim) with the locked direction. */
  onSwipePreviewStart?: (direction: AgendaSwipeDirection) => void
  /** C110 — the preview closes without navigation (snap-back, abandon, cancel). */
  onSwipePreviewEnd?: () => void
}): { suppressDateClickRef: MutableRefObject<boolean> } => {
  const gestureRef = useRef<AgendaSwipeGesture | null>(null)
  const enabledRef = useRef(enabled)
  const blockRefRef = useRef(blockRef)
  const onSwipeRef = useRef(onSwipe)
  const onSwipePreviewStartRef = useRef(onSwipePreviewStart)
  const onSwipePreviewEndRef = useRef(onSwipePreviewEnd)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  onSwipePreviewStartRef.current = onSwipePreviewStart
  onSwipePreviewEndRef.current = onSwipePreviewEnd

  const armClickSuppression = useCallback(() => {
    suppressDateClickRef.current = true
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(() => {
      suppressTimerRef.current = null
      suppressDateClickRef.current = false
    }, AGENDA_CLICK_SUPPRESSION_MS)
  }, [])

  const clearPendingExit = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    const container = containerRef.current
    if (!container) return
    container.classList.remove('activity-agenda-swipe-dragging', 'activity-agenda-swipe-exit')
  }, [containerRef])

  /** C110 — the live transform: follows the finger, clamped to the claimed
   * direction (the grid never crosses its starting point). */
  const applyTransform = useCallback(
    (dx: number, direction: AgendaSwipeDirection | null) => {
      const container = containerRef.current
      if (!container) return
      const clamped = direction === 'next' ? Math.min(dx, 0) : Math.max(dx, 0)
      container.style.transform = clamped === 0 ? '' : `translateX(${clamped}px)`
    },
    [containerRef],
  )

  /** C110 — release: animate the grid back to rest (commit slide or snap-back). */
  const settleTransform = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    container.classList.remove('activity-agenda-swipe-dragging')
    container.classList.add('activity-agenda-swipe-exit')
    container.style.transform = ''
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null
      container.classList.remove('activity-agenda-swipe-exit')
    }, AGENDA_SWIPE_EXIT_MS + 100)
  }, [containerRef])

  /** C110 — end a claimed gesture without committing: preview closes, grid settles. */
  const endWithoutCommit = useCallback(() => {
    settleTransform()
    onSwipePreviewEndRef.current?.()
  }, [settleTransform])

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (!enabledRef.current || blockRefRef.current.current) return
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      if (event.isPrimary === false) return

      // A new gesture means the previous one ended: its dateClick (if any) has
      // already fired, so a genuine tap right after a failed swipe is safe.
      // Any in-flight exit animation belongs to the previous gesture — the
      // new one owns the transform from here.
      suppressDateClickRef.current = false
      if (suppressTimerRef.current) {
        clearTimeout(suppressTimerRef.current)
        suppressTimerRef.current = null
      }
      clearPendingExit()

      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTarget: event.target,
        direction: null,
        lastDx: 0,
        lastDy: 0,
      }
    },
    [clearPendingExit],
  )

  /** C110 — the 12px claim lives in the non-passive touchmove (the same spot
   * the preventDefault must happen): lock the direction, start the preview,
   * arm the click suppression and kill FullCalendar's pending timers. */
  const claimGesture = useCallback(
    (gesture: AgendaSwipeGesture, dx: number, dy: number) => {
      gesture.direction = dx < 0 ? 'next' : 'prev'
      gesture.lastDx = dx
      gesture.lastDy = dy
      armClickSuppression()

      // Kill FullCalendar's pending long-press/tap timers: its touch
      // listeners are attached to the touchstart target, so the cancel must
      // be dispatched there while that node is still connected (synthetic
      // touchcancel = the browser taking the gesture away).
      const startTarget = gesture.startTarget
      if (typeof TouchEvent !== 'undefined' && startTarget instanceof Element) {
        startTarget.dispatchEvent(
          new TouchEvent('touchcancel', { bubbles: true, cancelable: true }),
        )
      }

      containerRef.current?.classList.add('activity-agenda-swipe-dragging')
      applyTransform(dx, gesture.direction)
      onSwipePreviewStartRef.current?.(gesture.direction)
    },
    [applyTransform, armClickSuppression, containerRef],
  )

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const gesture = gestureRef.current
      if (!gesture || blockRefRef.current.current) return
      const touch = event.touches[0]
      if (!touch) return

      const dx = touch.clientX - gesture.startX
      const dy = touch.clientY - gesture.startY
      if (gesture.direction === null) {
        if (
          Math.abs(dx) > AGENDA_SWIPE_CLAIM_PX &&
          Math.abs(dx) > Math.abs(dy) * AGENDA_SWIPE_DOMINANCE
        ) {
          // Clearly horizontal: keep the browser from claiming the gesture
          // for panning (which would pointercancel the stream before the
          // threshold) AND suppress the dateClick a sub-threshold flick would
          // otherwise trigger in the day view.
          event.preventDefault()
          claimGesture(gesture, dx, dy)
        }
        return
      }
      // C110 — already claimed: keep holding the gesture. The preventDefault
      // must repeat on EVERY move, not just the claim: the browser's
      // pan/flick recognizers re-evaluate on each touchmove, and an
      // unprevented move mid-drag fires a real pointercancel — killing the
      // live transform and the preview. (C101 got away with claim-only
      // preventDefault because its commit ended the gesture within a move or
      // two; the release decision keeps the gesture alive through many.)
      event.preventDefault()
      applyTransform(dx, gesture.direction)
    },
    [applyTransform, claimGesture],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (blockRefRef.current.current) {
        if (gesture.direction !== null) endWithoutCommit()
        gestureRef.current = null
        return
      }

      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      gesture.lastDx = dx
      gesture.lastDy = dy

      if (gesture.direction === null) {
        if (Math.abs(dx) < Math.abs(dy) * AGENDA_SWIPE_DOMINANCE) {
          // Vertical drag (scrolling the timeline, rescheduling): never claim.
          gestureRef.current = null
        }
        return
      }

      if (Math.abs(dx) < Math.abs(dy) * AGENDA_SWIPE_DOMINANCE) {
        // C110 — a claimed gesture turned vertical (scroll takeover): abandon,
        // snap back, close the preview. The browser is scrolling now — the
        // grid must not stay displaced.
        gestureRef.current = null
        endWithoutCommit()
        return
      }

      applyTransform(dx, gesture.direction)
    },
    [applyTransform, endWithoutCommit],
  )

  const handlePointerEnd = useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      gestureRef.current = null

      if (event.type === 'pointercancel') {
        if (gesture.direction !== null) endWithoutCommit()
        return
      }

      // C110 — the decision is the RELEASE: commit when the drag is far and
      // still horizontal, snap back otherwise. The threshold measures the
      // grid's ACTUAL displacement (the clamp-locked position the finger
      // left the grid at), not the raw delta — a gesture that reversed past
      // its origin released an undisplaced grid and must snap back.
      if (gesture.direction !== null) {
        const dx = gesture.lastDx
        const dy = gesture.lastDy
        const displaced = gesture.direction === 'next' ? Math.min(dx, 0) : Math.max(dx, 0)
        if (
          Math.abs(displaced) >= AGENDA_SWIPE_THRESHOLD_PX &&
          Math.abs(dx) >= Math.abs(dy) * AGENDA_SWIPE_DOMINANCE
        ) {
          settleTransform()
          onSwipePreviewEndRef.current?.()
          onSwipeRef.current(gesture.direction)
          return
        }
        endWithoutCommit()
      }
    },
    [endWithoutCommit, settleTransform],
  )

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
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    },
    [],
  )

  return { suppressDateClickRef }
}
