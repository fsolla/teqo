import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomeSearchResultsProvider } from '@/components/campaign/dashboard/HomeSearchResultsContext'
import { HomeSearchResultsLayout } from '@/components/campaign/dashboard/HomeSearchResultsLayout'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'

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

describe('HomeSearchResultsLayout', () => {
  it('renders a responsive grid container for result groups', () => {
    const { container } = render(
      <HomeSearchResultsProvider value={searchResultsValue()}>
        <HomeSearchResultsLayout>
          <p>Group A</p>
          <p>Group B</p>
        </HomeSearchResultsLayout>
      </HomeSearchResultsProvider>,
    )

    const layout = container.querySelector('[data-slot="home-search-results-layout"]')
    expect(layout?.className).toContain('flex-col')
    expect(layout?.className).toContain('md:grid-cols-2')
    expect(layout?.className).toContain('lg:grid-cols-3')
    expect(screen.getByText('Group A')).toBeTruthy()
    expect(screen.getByText('Group B')).toBeTruthy()
  })
})
