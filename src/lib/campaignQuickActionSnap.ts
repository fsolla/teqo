/** Collapsed peek — swipe handle only (replaces legacy bottom-nav `pb-24`). */
export const QUICK_ACTIONS_SNAP_COLLAPSED = '3rem' as const

/** Expanded — actions strip + global search inside the drawer. */
export const QUICK_ACTIONS_SNAP_EXPANDED = 0.55 as const

export const QUICK_ACTIONS_SNAP_POINTS = [
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_EXPANDED,
] as const

export type QuickActionsSnapPoint = (typeof QUICK_ACTIONS_SNAP_POINTS)[number]

export const quickActionsSnapIsExpanded = (snap: QuickActionsSnapPoint | null): boolean =>
  snap === QUICK_ACTIONS_SNAP_EXPANDED
