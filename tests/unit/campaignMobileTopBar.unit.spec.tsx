import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
import {
  CampaignWizardChromeProvider,
  useSetCampaignWizardChrome,
  type CampaignWizardChromeState,
} from '@/components/campaign/shell/CampaignWizardChromeContext'
import { SidebarProvider } from '@/components/ui/Sidebar'
import { stubMatchMedia } from '../helpers/matchMedia'

const ChromeProbe = ({ chrome }: { chrome: CampaignWizardChromeState | null }) => {
  useSetCampaignWizardChrome(chrome)
  return null
}

const renderTopBar = (chrome: CampaignWizardChromeState | null) =>
  render(
    <SidebarProvider>
      <CampaignWizardChromeProvider>
        <ChromeProbe chrome={chrome} />
        <CampaignMobileTopBar />
      </CampaignWizardChromeProvider>
    </SidebarProvider>,
  )

const renderWizardTopBar = (chrome: CampaignWizardChromeState) =>
  render(
    <SidebarProvider>
      <CampaignWizardChromeProvider>
        <ChromeProbe chrome={chrome} />
        <CampaignMobileTopBar />
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
    const { container } = renderTopBar(null)

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('app')
    expect(screen.getByText('Jorge Solla')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Voltar/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sair da ação' })).toBeNull()
  })

  it('renders wizard entry mode with dismiss control and flow title', () => {
    renderWizardTopBar({
      flowTitle: 'Ajustar votos',
      stepKind: 'entry',
      dismissHref: '/campanha',
    })

    expect(screen.getByText('Ajustar votos')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sair da ação' }).getAttribute('href')).toBe(
      '/campanha',
    )
    expect(screen.queryByRole('link', { name: /Voltar/ })).toBeNull()
  })

  it('renders wizard continue mode with back link and municipality subtitle', () => {
    renderWizardTopBar({
      flowTitle: 'Ajustar votos',
      municipalityLabel: 'Cairu',
      stepKind: 'continue',
      previousHref: '/campanha/acoes/atualizar-votos',
      dismissHref: '/campanha',
    })

    expect(screen.getByRole('link', { name: /Voltar/ }).getAttribute('href')).toBe(
      '/campanha/acoes/atualizar-votos',
    )
    expect(screen.getByLabelText('Município em atualização: Cairu').textContent).toBe('Cairu')
    expect(screen.getByRole('link', { name: 'Sair da ação' })).toBeTruthy()
  })

  it('renders skip link instead of dismiss when chained flow defines skip', () => {
    renderWizardTopBar({
      flowTitle: 'Registrar sinal',
      stepKind: 'continue',
      previousHref: '/campanha/acoes/atualizar-votos?municipio=cairu',
      dismissHref: '/campanha',
      skip: {
        label: 'Pular',
        href: '/campanha/acoes/mudar-tendencia?municipio=cairu',
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
          <ChromeProbe
            chrome={{
              flowTitle: 'Ajustar votos',
              stepKind: 'entry',
              dismissHref: '/campanha',
            }}
          />
          <CampaignMobileTopBar />
        </CampaignWizardChromeProvider>
      </SidebarProvider>,
    )

    expect(screen.queryByText('Jorge Solla')).toBeNull()

    rerender(
      <SidebarProvider>
        <CampaignWizardChromeProvider>
          <ChromeProbe
            chrome={{
              flowTitle: 'Ajustar votos',
              municipalityLabel: 'Cairu',
              stepKind: 'continue',
              previousHref: '/campanha/acoes/atualizar-votos',
              dismissHref: '/campanha',
            }}
          />
          <CampaignMobileTopBar />
        </CampaignWizardChromeProvider>
      </SidebarProvider>,
    )

    const topBar = document.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('wizard')
    expect(screen.queryByText('Jorge Solla')).toBeNull()
    expect(screen.getByLabelText('Município em atualização: Cairu')).toBeTruthy()
  })
})
