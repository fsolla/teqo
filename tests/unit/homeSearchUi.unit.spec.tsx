import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchMunicipalityGroup } from '@/components/campaign/dashboard/HomeSearchMunicipalityGroup'
import { HomeSearchResultsProvider } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import {
  HOME_SEARCH_GROUP_HEADING_CLASS,
  HOME_SEARCH_GROUP_LIST_CLASS,
  HOME_SEARCH_HIT_ROW_WRAPPER_CLASS,
} from '@/lib/homeSearchUi'

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
      ...data,
    },
  },
  isFetching: false,
  resultKind,
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
  it('renders a discreet sentence-case heading and list without bullets', () => {
    const { container } = render(
      <HomeSearchResultsProvider
        value={searchResultsValue({
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
        })}
      >
        <HomeSearchMunicipalityGroup />
      </HomeSearchResultsProvider>,
    )

    const heading = screen.getByRole('heading', { name: 'Municípios' })
    expect(heading.className).toBe(HOME_SEARCH_GROUP_HEADING_CLASS)
    expect(heading.className).not.toContain('uppercase')

    const list = container.querySelector('ul')
    expect(list?.className).toBe(HOME_SEARCH_GROUP_LIST_CLASS)
  })
})
