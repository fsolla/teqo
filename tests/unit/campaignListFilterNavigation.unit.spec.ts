import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  replace: vi.fn(),
}))

vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  useRouter: () => ({ replace: routerState.replace }),
}))

import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'

type TestState = { q?: string; tag?: string }

const TestNavigateOnlyFilters = ({ state }: { state: TestState }) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => {
      const params = new URLSearchParams()
      if (next.q) params.set('q', next.q)
      if (next.tag) params.set('tag', next.tag)
      const query = params.toString()
      return query ? `/test?${query}` : '/test'
    },
  })

  return createElement(
    'form',
    { role: 'search', 'data-pending': isPending },
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => navigate({ ...state, tag: 'applied' }),
      },
      'Aplicar',
    ),
  )
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

describe('campaign list filter navigation (navigate-only / B128)', () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
  })

  afterEach(() => {
    cleanup()
    routerState.replace.mockReset()
  })

  it('navigates immediately without debounce when using navigate()', () => {
    render(
      createElement(
        CampaignListPendingBoundary,
        null,
        createElement(TestNavigateOnlyFilters, { state: {} }),
      ),
    )

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    })

    expect(routerState.replace).toHaveBeenCalledTimes(1)
    expect(routerState.replace).toHaveBeenCalledWith('/test?tag=applied', { scroll: false })
  })
})
