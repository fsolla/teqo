import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, createElement, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  replace: vi.fn(),
}))

vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  useRouter: () => ({ replace: routerState.replace }),
}))

import { MunicipalityFilters } from '@/components/campaign/municipality/MunicipalityFilters'
import { TerritoryFilters } from '@/components/campaign/municipality/TerritoryFilters'
import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { SEARCH_DEBOUNCE_MS } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { StateDeputyFilters } from '@/components/campaign/stateDeputy/StateDeputyFilters'

/**
 * The three list filter shells share one navigation scaffold
 * (`useCampaignListFilterNavigation`). These cases are the contract that
 * survives the extraction: debounce window, no-op dedup, unmount cleanup, and
 * carrying the uncommitted search into a filter/sort navigation.
 */
type FilterCase = {
  name: string
  searchLabel: string
  /** Canonical href for a committed `silva` search with no other state. */
  hrefWithQuery: string
  /** Canonical href for no state at all — what "Limpar" must navigate to. */
  bareHref: string
  /**
   * A `key|dir` from the list's own sort options that is NOT its default —
   * otherwise `sort=` drops out of the canonical href and the assertion fails
   * for a reason unrelated to the hook.
   */
  sortValue: string
  element: (currentQuery?: string) => ReactElement
  /** Same shell with `sortValue` already committed — an external navigation. */
  elementWithSort: () => ReactElement
}

const filterCases: FilterCase[] = [
  {
    name: 'dobradinhas',
    searchLabel: 'Buscar dobradinha',
    hrefWithQuery: '/campanha/dobradinhas?q=silva',
    bareHref: '/campanha/dobradinhas',
    sortValue: 'party|asc',
    element: (currentQuery) =>
      createElement(StateDeputyFilters, {
        state: { page: 1, ...(currentQuery ? { q: currentQuery } : {}) },
        partyOptions: [],
        hasNoParty: false,
      }),
    elementWithSort: () =>
      createElement(StateDeputyFilters, {
        state: { page: 1, sort: 'party', dir: 'asc' },
        partyOptions: [],
        hasNoParty: false,
      }),
  },
  {
    name: 'territórios',
    searchLabel: 'Buscar território',
    hrefWithQuery: '/campanha/territorios?q=silva',
    bareHref: '/campanha/territorios',
    sortValue: 'region|asc',
    element: (currentQuery) =>
      createElement(TerritoryFilters, {
        state: { ...(currentQuery ? { q: currentQuery } : {}) },
        regionOptions: [],
      }),
    elementWithSort: () =>
      createElement(TerritoryFilters, {
        state: { sort: 'region', dir: 'asc' },
        regionOptions: [],
      }),
  },
  {
    name: 'municípios',
    searchLabel: 'Buscar município',
    hrefWithQuery: '/campanha/municipios?q=silva',
    bareHref: '/campanha/municipios',
    sortValue: 'name|asc',
    element: (currentQuery) =>
      createElement(MunicipalityFilters, {
        state: { page: 1, ...(currentQuery ? { q: currentQuery } : {}) },
        showStaffFilters: true,
        regionFilterOptions: [],
        advisorFilterOptions: [],
      }),
    elementWithSort: () =>
      createElement(MunicipalityFilters, {
        state: { page: 1, sort: 'name', dir: 'asc' },
        showStaffFilters: true,
        regionFilterOptions: [],
        advisorFilterOptions: [],
      }),
  },
]

/**
 * Always inside the boundary: in production all three shells render under one,
 * so the local `useTransition` fallback is the branch that never runs.
 */
const mountCase = ({ element }: FilterCase, currentQuery?: string) => {
  const { rerender } = render(
    createElement(CampaignListPendingBoundary, null, element(currentQuery)),
  )

  return {
    /** Re-renders with new committed state, as a navigation from elsewhere would. */
    rerenderWith: (next: ReactElement) =>
      rerender(createElement(CampaignListPendingBoundary, null, next)),
  }
}

const typeSearch = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('campaign list filter navigation', () => {
  beforeEach(() => {
    // React's scheduler needs real microtasks; only the debounce clock is faked.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    routerState.replace.mockReset()
  })

  it.each(filterCases)(
    '$name: debounces the search into a single canonical replace',
    (filterCase) => {
      const { searchLabel, hrefWithQuery } = filterCase
      mountCase(filterCase)

      typeSearch(searchLabel, 'silva')
      advance(SEARCH_DEBOUNCE_MS - 1)
      expect(routerState.replace).not.toHaveBeenCalled()

      advance(1)
      expect(routerState.replace).toHaveBeenCalledTimes(1)
      expect(routerState.replace).toHaveBeenCalledWith(hrefWithQuery, { scroll: false })
    },
  )

  it.each(filterCases)(
    '$name: restarts the debounce window while the user keeps typing',
    (filterCase) => {
      const { searchLabel, hrefWithQuery } = filterCase
      mountCase(filterCase)

      typeSearch(searchLabel, 'sil')
      advance(SEARCH_DEBOUNCE_MS - 200)
      typeSearch(searchLabel, 'silva')
      advance(SEARCH_DEBOUNCE_MS - 200)
      expect(routerState.replace).not.toHaveBeenCalled()

      advance(200)
      expect(routerState.replace).toHaveBeenCalledTimes(1)
      expect(routerState.replace).toHaveBeenCalledWith(hrefWithQuery, { scroll: false })
    },
  )

  it.each(filterCases)(
    '$name: skips navigation when the query would not change the URL',
    (filterCase) => {
      const { searchLabel } = filterCase
      mountCase(filterCase, 'silva')

      typeSearch(searchLabel, 'silva ')
      advance(SEARCH_DEBOUNCE_MS)
      expect(routerState.replace).not.toHaveBeenCalled()

      fireEvent.submit(screen.getByRole('search'))
      expect(routerState.replace).not.toHaveBeenCalled()
    },
  )

  it.each(filterCases)('$name: cancels the pending search navigation on unmount', (filterCase) => {
    const { searchLabel } = filterCase
    mountCase(filterCase)

    typeSearch(searchLabel, 'silva')
    cleanup()
    advance(SEARCH_DEBOUNCE_MS)

    expect(routerState.replace).not.toHaveBeenCalled()
  })

  it.each(filterCases)(
    '$name: carries the uncommitted search when another control navigates',
    (filterCase) => {
      const { searchLabel, sortValue } = filterCase
      mountCase(filterCase)

      typeSearch(searchLabel, 'silva')
      fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: sortValue } })

      expect(routerState.replace).toHaveBeenCalledTimes(1)
      const [href] = routerState.replace.mock.calls[0] as [string, unknown]
      expect(href).toContain('q=silva')
      expect(href).toContain(`sort=${sortValue.split('|')[0]}`)

      // The sort consumed the pending search; the timer must not fire a second one.
      advance(SEARCH_DEBOUNCE_MS)
      expect(routerState.replace).toHaveBeenCalledTimes(1)
    },
  )

  it.each(filterCases)(
    '$name: clears the box and the query in one deduped navigation',
    (filterCase) => {
      const { searchLabel, bareHref } = filterCase
      mountCase(filterCase, 'silva')

      fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))

      expect((screen.getByLabelText(searchLabel) as HTMLInputElement).value).toBe('')
      expect(routerState.replace).toHaveBeenCalledTimes(1)
      expect(routerState.replace).toHaveBeenCalledWith(bareHref, { scroll: false })
    },
  )

  it.each(filterCases)(
    '$name: a pending search does not revert a navigation made from outside the shell',
    (filterCase) => {
      const { searchLabel, sortValue, elementWithSort } = filterCase
      const { rerenderWith } = mountCase(filterCase)

      typeSearch(searchLabel, 'silva')
      // A sortable head / pagination link commits new state mid-debounce.
      rerenderWith(elementWithSort())
      advance(SEARCH_DEBOUNCE_MS)

      expect(routerState.replace).toHaveBeenCalledTimes(1)
      const [href] = routerState.replace.mock.calls[0] as [string, unknown]
      expect(href).toContain('q=silva')
      expect(href).toContain(`sort=${sortValue.split('|')[0]}`)
    },
  )

  it.each(filterCases)(
    '$name: emptying a committed search navigates to the query-less URL',
    (filterCase) => {
      const { searchLabel, bareHref } = filterCase
      mountCase(filterCase, 'silva')

      typeSearch(searchLabel, '')
      advance(SEARCH_DEBOUNCE_MS)

      expect(routerState.replace).toHaveBeenCalledTimes(1)
      expect(routerState.replace).toHaveBeenCalledWith(bareHref, { scroll: false })
    },
  )
})
