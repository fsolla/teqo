import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchProvider } from '@/components/campaign/dashboard/HomeSearchContext'
import { HomeSearchMunicipalityGroup } from '@/components/campaign/dashboard/HomeSearchMunicipalityGroup'
import { HomeSearchResultsProvider } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import {
  HOME_SEARCH_GROUP_HEADING_CLASS,
  HOME_SEARCH_GROUP_LIST_CLASS,
  HOME_SEARCH_HIT_ROW_WRAPPER_CLASS,
} from '@/lib/homeSearchUi'
import { stub } from '../helpers/stub'

const homeSearchController = (uiFocused = false) =>
  stub({
    query: { raw: '', debounced: '', isActive: false },
    setRaw: () => {},
    clear: () => {},
    isDebouncing: false,
    inputFocused: uiFocused,
    setInputFocused: () => {},
    uiFocused,
  })

const renderMunicipalityGroup = (
  resultsValue: ReturnType<typeof searchResultsValue>,
  uiFocused = false,
) =>
  render(
    <HomeSearchProvider value={homeSearchController(uiFocused)}>
      <HomeSearchResultsProvider value={resultsValue}>
        <HomeSearchMunicipalityGroup />
      </HomeSearchResultsProvider>
    </HomeSearchProvider>,
  )

const searchResultsValue = (
  data: Partial<HomeSearchSuccessResponse> = {},
  resultKind: HomeSearchSuccessResponse['resultKind'] = 'search',
) => ({
  results: {
    status: 'success' as const,
    data: {
      status: 'success' as const,
      resultKind,
      municipalities: [],
      territories: [],
      advisors: [],
      leaderships: [],
      stateDeputies: [],
      activities: [],
      demands: [],
      ...data,
    },
  },
  isFetching: false,
  resultKind,
})

// next/link schedules viewport-prefetch work via the React scheduler; without
// an explicit unmount the callback can fire after the jsdom teardown and crash
// the run with "window is not defined" (CI flake 2026-07-30, run 30587862940 —
// same afterEach(cleanup) pattern as the 14 sibling specs).
afterEach(() => {
  cleanup()
})

describe('HomeSearchHitRow', () => {
  it('wraps the link in a full-bleed hover strip', () => {
    const { container } = render(
      <HomeSearchHitRow href="/campanha/municipios/cairu" primary="Cairu" secondary="Recôncavo" />,
    )

    const bleed = container.firstElementChild
    expect(bleed?.className).toBe(HOME_SEARCH_HIT_ROW_WRAPPER_CLASS)
    expect(screen.getByRole('link', { name: /Cairu/i }).className).not.toContain('rounded-md')
  })
})

describe('HomeSearchMunicipalityGroup', () => {
  it('omits the visible heading in suggest mode while keeping an accessible section name', () => {
    renderMunicipalityGroup(
      searchResultsValue(
        {
          municipalities: [
            {
              kind: 'municipality',
              slug: 'cairu',
              name: 'Cairu',
              region: 'Recôncavo',
              priority: null,
              votePosition2022: null,
            },
          ],
        },
        'suggest',
      ),
      true,
    )

    expect(screen.queryByRole('heading', { name: 'Sugestões' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Sugestões' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Cairu/i })).toBeTruthy()
  })

  it('renders a discreet sentence-case heading and list without bullets', () => {
    const { container } = renderMunicipalityGroup(
      searchResultsValue({
        municipalities: [
          {
            kind: 'municipality',
            slug: 'cairu',
            name: 'Cairu',
            region: 'Recôncavo',
            priority: null,
            votePosition2022: null,
          },
        ],
      }),
    )

    const heading = screen.getByRole('heading', { name: 'Municípios' })
    expect(heading.className).toBe(HOME_SEARCH_GROUP_HEADING_CLASS)

    const list = container.querySelector('ul')
    expect(list?.className).toBe(HOME_SEARCH_GROUP_LIST_CLASS)
  })
})
