/** Collapsed peek — swipe handle only (replaces legacy bottom-nav `pb-24`). */
export const QUICK_ACTIONS_SNAP_COLLAPSED = '3rem' as const

/** Dock — action strip + global search visible on load and after navigation. */
export const QUICK_ACTIONS_SNAP_DOCK = '12rem' as const

/** Scroll down past this threshold on `campaign-content-scroll` collapses the drawer. */
export const QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX = 24

export const QUICK_ACTIONS_SNAP_POINTS = [
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
] as const

export type QuickActionsSnapPoint = (typeof QUICK_ACTIONS_SNAP_POINTS)[number]

export const quickActionsSnapIsDock = (snap: QuickActionsSnapPoint | null): boolean =>
  snap === QUICK_ACTIONS_SNAP_DOCK
