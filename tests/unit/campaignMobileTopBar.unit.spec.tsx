import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

import {
  CampaignHomeSearchChromeProvider,
  useSetCampaignHomeSearchChrome,
  type CampaignHomeSearchChromeState,
} from '@/components/campaign/shell/CampaignHomeSearchChromeContext'
import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
import {
  CampaignWizardChromeProvider,
  useSetCampaignWizardChrome,
  type CampaignWizardChromeState,
} from '@/components/campaign/shell/CampaignWizardChromeContext'
import { SidebarProvider } from '@/components/ui/Sidebar'
import { CAMPAIGN_HOME_TOP_BAR_LINK_ARIA_LABEL } from '@/lib/campaignWizardCopy'
import { stubMatchMedia } from '../helpers/matchMedia'

const WizardChromeProbe = ({ chrome }: { chrome: CampaignWizardChromeState | null }) => {
  useSetCampaignWizardChrome(chrome)
  return null
}

const HomeSearchChromeProbe = ({ chrome }: { chrome: CampaignHomeSearchChromeState | null }) => {
  useSetCampaignHomeSearchChrome(chrome)
  return null
}

const renderTopBar = (input: {
  wizardChrome?: CampaignWizardChromeState | null
  homeSearchChrome?: CampaignHomeSearchChromeState | null
}) =>
  render(
    <SidebarProvider>
      <CampaignWizardChromeProvider>
        <CampaignHomeSearchChromeProvider>
          <WizardChromeProbe chrome={input.wizardChrome ?? null} />
          <HomeSearchChromeProbe chrome={input.homeSearchChrome ?? null} />
          <CampaignMobileTopBar />
        </CampaignHomeSearchChromeProvider>
      </CampaignWizardChromeProvider>
    </SidebarProvider>,
  )

describe('CampaignMobileTopBar', () => {
  beforeEach(() => {
    stubMatchMedia()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders app mode with sidebar trigger when chrome is null', () => {
    const { container } = renderTopBar({})

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('app')
    expect(screen.getByText('Jorge Solla')).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: CAMPAIGN_HOME_TOP_BAR_LINK_ARIA_LABEL })
        .getAttribute('href'),
    ).toBe('/campanha')
    expect(screen.queryByRole('link', { name: /Voltar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fechar busca' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sair da ação' })).toBeNull()
  })

  it('renders app mode with Voltar when home search is focused (B106)', () => {
    const collapse = vi.fn()
    const { container } = renderTopBar({
      homeSearchChrome: { focused: true, collapse },
    })

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-home-search-focused')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Abrir ou fechar menu da campanha' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar busca' }))
    expect(collapse).toHaveBeenCalledTimes(1)
  })

  it('renders wizard entry mode with dismiss control and flow title', () => {
    renderTopBar({
      wizardChrome: {
        flowTitle: 'Ajustar votos',
        stepKind: 'entry',
        dismissHref: '/campanha',
      },
    })

    expect(screen.getByText('Ajustar votos')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sair da ação' }).getAttribute('href')).toBe(
      '/campanha',
    )
    expect(screen.queryByRole('link', { name: /Voltar/ })).toBeNull()
  })

  it('renders wizard continue mode with back link and municipality subtitle', () => {
    renderTopBar({
      wizardChrome: {
        flowTitle: 'Ajustar votos',
        municipalityLabel: 'Cairu',
        stepKind: 'continue',
        previousHref: '/campanha/acoes/atualizar-votos',
        dismissHref: '/campanha',
      },
    })

    expect(screen.getByRole('link', { name: /Voltar/ }).getAttribute('href')).toBe(
      '/campanha/acoes/atualizar-votos',
    )
    expect(screen.getByLabelText('Município em atualização: Cairu').textContent).toBe('Cairu')
    expect(screen.getByRole('link', { name: 'Sair da ação' })).toBeTruthy()
  })

  it('renders skip link instead of dismiss when chained flow defines skip', () => {
    renderTopBar({
      wizardChrome: {
        flowTitle: 'Registrar sinal',
        stepKind: 'continue',
        previousHref: '/campanha/acoes/atualizar-votos?municipio=cairu',
        dismissHref: '/campanha',
        skip: {
          label: 'Pular',
          href: '/campanha/acoes/mudar-tendencia?municipio=cairu',
        },
      },
    })

    expect(screen.getByRole('link', { name: 'Pular' }).getAttribute('href')).toBe(
      '/campanha/acoes/mudar-tendencia?municipio=cairu',
    )
    expect(screen.queryByRole('link', { name: 'Sair da ação' })).toBeNull()
  })

  it('keeps wizard mode when chrome updates between steps', () => {
    const { rerender } = render(
      <SidebarProvider>
        <CampaignWizardChromeProvider>
          <CampaignHomeSearchChromeProvider>
            <WizardChromeProbe
              chrome={{
                flowTitle: 'Ajustar votos',
                stepKind: 'entry',
                dismissHref: '/campanha',
              }}
            />
            <CampaignMobileTopBar />
          </CampaignHomeSearchChromeProvider>
        </CampaignWizardChromeProvider>
      </SidebarProvider>,
    )

    expect(screen.queryByText('Jorge Solla')).toBeNull()

    rerender(
      <SidebarProvider>
        <CampaignWizardChromeProvider>
          <CampaignHomeSearchChromeProvider>
            <WizardChromeProbe
              chrome={{
                flowTitle: 'Ajustar votos',
                municipalityLabel: 'Cairu',
                stepKind: 'continue',
                previousHref: '/campanha/acoes/atualizar-votos',
                dismissHref: '/campanha',
              }}
            />
            <CampaignMobileTopBar />
          </CampaignHomeSearchChromeProvider>
        </CampaignWizardChromeProvider>
      </SidebarProvider>,
    )

    const topBar = document.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('wizard')
    expect(screen.queryByText('Jorge Solla')).toBeNull()
    expect(screen.getByLabelText('Município em atualização: Cairu')).toBeTruthy()
  })
})
