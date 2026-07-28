import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, createElement, type ReactElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  push: vi.fn(),
  /**
   * Resolves the in-flight `push` Promise so the React 19 transition can
   * settle. The shared pending boundary stays busy until this runs.
   */
  resolvePush: null as (() => void) | null,
}))

vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  useRouter: () => ({
    push: (...args: unknown[]) => routerState.push(...args),
  }),
}))

import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { TourRegionPicker } from '@/components/campaign/tour/TourRegionPicker'

/**
 * The composer isn't a list, but it reuses the list pending pieces. This pin
 * is the contract the E13 `/simplify` missed: changing Território drives the
 * shared transition so `CampaignListResults` dims (`data-pending` / `aria-busy`)
 * while the picker keeps its own spinner.
 */
const regions = [
  { region: 'Sisal', municipalityCount: 3, href: '/campanha/atividades/giros?region=Sisal' },
  {
    region: 'Portal do Sertão',
    municipalityCount: 5,
    href: '/campanha/atividades/giros?region=Portal%20do%20Sert%C3%A3o',
  },
]

const mountComposer = (): ReactElement =>
  createElement(
    CampaignListPendingBoundary,
    null,
    createElement(TourRegionPicker, {
      regions,
      selectedRegion: 'Sisal',
      clearHref: '/campanha/atividades/giros',
    }),
    createElement(CampaignListResults, null, createElement('p', null, 'Proposta do giro Sisal')),
  )

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

describe('tour region pending', () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
  })

  afterEach(() => {
    cleanup()
    routerState.push.mockReset()
    routerState.resolvePush = null
  })

  it('dims the results region while the territory navigation is in flight', async () => {
    routerState.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          routerState.resolvePush = resolve
        }),
    )

    render(mountComposer())

    const results = screen.getByText('Proposta do giro Sisal').parentElement
    expect(results).not.toBeNull()
    expect(results!.getAttribute('aria-busy')).not.toBe('true')
    expect(results!.getAttribute('data-pending')).toBeNull()

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Território de Identidade'), {
        target: { value: 'Portal do Sertão' },
      })
    })

    expect(routerState.push).toHaveBeenCalledWith(regions[1].href, { scroll: false })
    expect(results!.getAttribute('aria-busy')).toBe('true')
    expect(results!.getAttribute('data-pending')).toBe('true')
    expect(screen.getByText('Atualizando resultados…')).toBeTruthy()
    expect(screen.getByText('Montando a proposta de giro…')).toBeTruthy()
    expect((screen.getByLabelText('Território de Identidade') as HTMLSelectElement).disabled).toBe(
      true,
    )

    await act(async () => {
      routerState.resolvePush?.()
    })

    expect(results!.getAttribute('aria-busy')).not.toBe('true')
    expect(results!.getAttribute('data-pending')).toBeNull()
  })
})
