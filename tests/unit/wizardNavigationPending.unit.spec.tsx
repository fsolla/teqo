import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  push: vi.fn(),
  resolvePush: null as (() => void) | null,
}))

vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  usePathname: () => '/campanha/acoes/atualizar-votos',
  useRouter: () => ({
    push: (...args: unknown[]) => routerState.push(...args),
    replace: vi.fn(),
  }),
}))

import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { CampaignPageChromeProvider } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
import { CampaignWizardChromeProvider } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { SidebarProvider } from '@/components/ui/Sidebar'
import { WIZARD_STEP_PENDING_MESSAGE } from '@/lib/campaignWizardCopy'
import { stubMatchMedia } from '../helpers/matchMedia'

const mountWizardNavigation = () =>
  render(
    <SidebarProvider>
      <CampaignPageChromeProvider role="coordinator">
        <CampaignWizardChromeProvider>
          <CampaignListPendingBoundary>
            <CampaignMobileTopBar />
            <CampaignWizardShell
            flowTitle="Ajustar votos"
            stepTitle="Quantos votos?"
            isEntryStep={false}
            previousHref="/campanha/acoes/atualizar-votos"
            dismissHref="/campanha"
            municipalityLabel="Cairu"
          >
            Corpo do passo
          </CampaignWizardShell>
        </CampaignListPendingBoundary>
      </CampaignWizardChromeProvider>
      </CampaignPageChromeProvider>
    </SidebarProvider>,
  )

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

describe('wizard navigation pending', () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    stubMatchMedia()
  })

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
  })

  afterEach(() => {
    cleanup()
    routerState.push.mockReset()
    routerState.resolvePush = null
    vi.unstubAllGlobals()
  })

  it('dims step content and locks chrome while Voltar navigation is in flight', async () => {
    routerState.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          routerState.resolvePush = resolve
        }),
    )

    mountWizardNavigation()

    const stepBody = screen.getByRole('heading', { level: 1, name: 'Quantos votos?' }).parentElement
    expect(stepBody).not.toBeNull()
    expect(stepBody!.getAttribute('aria-busy')).not.toBe('true')
    expect(stepBody!.getAttribute('data-pending')).toBeNull()

    const backLink = screen.getByRole('link', { name: /Voltar/ })

    await act(async () => {
      fireEvent.click(backLink)
    })

    expect(routerState.push).toHaveBeenCalledWith('/campanha/acoes/atualizar-votos', {
      scroll: true,
    })

    await waitFor(() => {
      expect(stepBody!.getAttribute('aria-busy')).toBe('true')
      expect(stepBody!.getAttribute('data-pending')).toBe('true')
    })
    expect(screen.getByText(WIZARD_STEP_PENDING_MESSAGE)).toBeTruthy()
    expect(backLink.getAttribute('aria-busy')).toBe('true')
    await waitFor(() => {
      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    })

    await act(async () => {
      routerState.resolvePush?.()
    })

    expect(stepBody!.getAttribute('aria-busy')).not.toBe('true')
    expect(stepBody!.getAttribute('data-pending')).toBeNull()
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()
  })
})
