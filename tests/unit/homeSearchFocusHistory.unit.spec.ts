import { describe, expect, it } from 'vitest'

import {
  HOME_SEARCH_FOCUS_HISTORY_KEY,
  isHomeSearchFocusHistoryState,
  shouldCollapseHomeSearchOnPopstate,
} from '@/lib/homeSearchFocusHistory'

describe('homeSearchFocusHistory', () => {
  it('recognizes the focus history mark', () => {
    expect(isHomeSearchFocusHistoryState({ [HOME_SEARCH_FOCUS_HISTORY_KEY]: true })).toBe(true)
    expect(isHomeSearchFocusHistoryState({})).toBe(false)
    expect(isHomeSearchFocusHistoryState(null)).toBe(false)
  })

  it('collapses on popstate only when focus history was pushed by us', () => {
    expect(
      shouldCollapseHomeSearchOnPopstate({
        wasHistoryPushed: true,
        closingProgrammatically: false,
      }),
    ).toBe(true)

    expect(
      shouldCollapseHomeSearchOnPopstate({
        wasHistoryPushed: true,
        closingProgrammatically: true,
      }),
    ).toBe(false)

    expect(
      shouldCollapseHomeSearchOnPopstate({
        wasHistoryPushed: false,
        closingProgrammatically: false,
      }),
    ).toBe(false)
  })
})
