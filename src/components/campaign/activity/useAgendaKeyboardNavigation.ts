'use client'

import { useCallback, useRef, type KeyboardEvent, type RefObject } from 'react'

export type AgendaKeyboardDirection = 'next' | 'prev'

const AGENDA_KEYBOARD_SKIP_SELECTOR = '[role="dialog"], [role="menu"]'

/**
 * C101-ux — pure decision for the agenda's keyboard period navigation. FullCalendar
 * v7 has no arrow-key navigation of its own (verified in the installed bundle:
 * only Enter/Space activation attrs and Escape in the more-popover), so the
 * mobile agenda maps ArrowLeft/ArrowRight to prev/next on the keyboard-region
 * container — the same direction semantics as the swipe gesture (right moves
 * forward).
 *
 * Returns `null` (and the caller does nothing) when the key is not a period
 * arrow, when a modifier is held (never hijack browser/AT shortcuts), or when
 * the event's target lives inside a construct with its own arrow semantics:
 * the FullCalendar more-popover (`role="dialog"`) and menus. Form controls are
 * skipped defensively — the grid has none, but a future FC internals change
 * must not break typing.
 */
export const agendaKeyboardDirection = (event: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  target: EventTarget | null
}): AgendaKeyboardDirection | null => {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  const target = event.target
  if (target instanceof Element) {
    if (target.closest(AGENDA_KEYBOARD_SKIP_SELECTOR)) return null
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return null
    }
  }
  if (event.key === 'ArrowRight') return 'next'
  if (event.key === 'ArrowLeft') return 'prev'
  return null
}

/**
 * C101-ux — keyboard period navigation for the mobile agenda. The calendar
 * container is a keyboard region on phones (mobile-only `tabIndex={0}`,
 * `role="group"`), so ArrowLeft/ArrowRight reach it and map to prev/next —
 * mirroring `useAgendaSwipeNavigation`'s shape: render-gated via `enabled`
 * (the same `isMobile` signal as the C101 chrome), and ref-based so the
 * memoized handler always sees the current `enabled`/`onNavigate`.
 *
 * After navigating, focus is restored to the region: changing the period
 * re-renders the grid and destroys the focused node (event anchor / date
 * cell); the region survives the transition and keeps the keyboard navigating.
 * `preventScroll` keeps the restore from scrolling the timeline.
 */
export const useAgendaKeyboardNavigation = ({
  containerRef,
  enabled,
  onNavigate,
}: {
  containerRef: RefObject<HTMLElement | null>
  /** Render-time gate (viewport-driven): when false, no key navigates. */
  enabled: boolean
  onNavigate: (direction: AgendaKeyboardDirection) => void
}) => {
  const enabledRef = useRef(enabled)
  const onNavigateRef = useRef(onNavigate)

  enabledRef.current = enabled
  onNavigateRef.current = onNavigate

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!enabledRef.current) return
      const direction = agendaKeyboardDirection(event)
      if (!direction) return
      event.preventDefault()
      onNavigateRef.current(direction)
      containerRef.current?.focus({ preventScroll: true })
    },
    [containerRef],
  )

  return { handleKeyDown }
}
