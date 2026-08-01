/** History state mark for Início mobile search focus (B106). */
export const HOME_SEARCH_FOCUS_HISTORY_KEY = 'teqoHomeSearchFocus' as const

export type HomeSearchFocusHistoryState = {
  [HOME_SEARCH_FOCUS_HISTORY_KEY]?: true
}

export const isHomeSearchFocusHistoryState = (state: unknown): state is HomeSearchFocusHistoryState =>
  typeof state === 'object' &&
  state !== null &&
  HOME_SEARCH_FOCUS_HISTORY_KEY in state &&
  (state as HomeSearchFocusHistoryState)[HOME_SEARCH_FOCUS_HISTORY_KEY] === true

/**
 * After popstate, the active entry may no longer carry our mark — collapse when
 * focus mode was open and the browser popped our synthetic entry.
 */
export const shouldCollapseHomeSearchOnPopstate = (input: {
  wasHistoryPushed: boolean
  closingProgrammatically: boolean
}): boolean => input.wasHistoryPushed && !input.closingProgrammatically
