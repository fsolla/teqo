/** Collapsed peek — handle + discreet search (no action strip). */
export const QUICK_ACTIONS_SNAP_COLLAPSED = '6.5rem' as const

/** Dock — handle + action strip (2-line labels) + global search. */
export const QUICK_ACTIONS_SNAP_DOCK = '15rem' as const

/** Full viewport — search focus/active; covers mobile top bar (B109). */
export const QUICK_ACTIONS_SNAP_FULL = 1 as const

/**
 * Scroll delta past this threshold on `campaign-content-scroll` collapses (↓)
 * or re-docks (↑) the drawer.
 */
export const QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX = 24

export const QUICK_ACTIONS_SNAP_POINTS = [
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  QUICK_ACTIONS_SNAP_FULL,
] as const

export type QuickActionsSnapPoint = (typeof QUICK_ACTIONS_SNAP_POINTS)[number]

export type QuickActionsScrollDirection = 'up' | 'down' | 'none'

export const quickActionsSnapIsFull = (snap: QuickActionsSnapPoint | null): boolean =>
  snap === QUICK_ACTIONS_SNAP_FULL

export const quickActionsSnapIsDock = (snap: QuickActionsSnapPoint | null): boolean =>
  snap === QUICK_ACTIONS_SNAP_DOCK

export const quickActionsSnapIsCollapsed = (snap: QuickActionsSnapPoint | null): boolean =>
  snap === QUICK_ACTIONS_SNAP_COLLAPSED

/**
 * B112 — empty blur, handle tap/swipe ↓, and in-chrome navigation all land on
 * collapsed (clear search separately so `uiFocused → FULL` cannot reopen).
 */
export const quickActionsSnapAfterDismiss = (): QuickActionsSnapPoint =>
  QUICK_ACTIONS_SNAP_COLLAPSED

/** Pure scroll-direction detector for the quick-actions peek (B105). */
export const quickActionsScrollDirection = (
  previousScrollTop: number,
  nextScrollTop: number,
  thresholdPx: number = QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX,
): QuickActionsScrollDirection => {
  const delta = nextScrollTop - previousScrollTop
  if (delta > thresholdPx) return 'down'
  if (delta < -thresholdPx) return 'up'
  return 'none'
}
