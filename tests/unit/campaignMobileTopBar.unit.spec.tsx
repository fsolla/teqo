import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pathnameState = vi.hoisted(() => ({ value: '/campanha/municipios' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
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
import { CampaignPageChromeProvider } from '@/components/campaign/shell/CampaignPageChromeContext'
import {
  CampaignWizardChromeProvider,
  useSetCampaignWizardChrome,
  type CampaignWizardChromeState,
} from '@/components/campaign/shell/CampaignWizardChromeContext'
import { SidebarProvider } from '@/components/ui/Sidebar'
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
  pathname?: string
}) => {
  pathnameState.value = input.pathname ?? '/campanha/municipios'
  return render(
    <SidebarProvider>
      <CampaignPageChromeProvider role="coordinator">
        <CampaignWizardChromeProvider>
          <CampaignHomeSearchChromeProvider>
            <WizardChromeProbe chrome={input.wizardChrome ?? null} />
            <HomeSearchChromeProbe chrome={input.homeSearchChrome ?? null} />
            <CampaignMobileTopBar />
          </CampaignHomeSearchChromeProvider>
        </CampaignWizardChromeProvider>
      </CampaignPageChromeProvider>
    </SidebarProvider>,
  )
}

describe('CampaignMobileTopBar', () => {
  beforeEach(() => {
    stubMatchMedia()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders page chrome from pathname in app mode', () => {
    const { container } = renderTopBar({})

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('app')
    expect(screen.getByText('Municípios')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Voltar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fechar busca' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sair da ação' })).toBeNull()
  })

  it('renders empty chrome on home', () => {
    const { container } = renderTopBar({ pathname: '/campanha' })

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('app')
    expect(container.querySelector('[data-slot="campaign-page-chrome"]')).toBeNull()
  })

  it('renders app mode with Voltar when home search is focused (B106)', () => {
    const collapse = vi.fn()
    const { container } = renderTopBar({
      pathname: '/campanha',
      homeSearchChrome: { focused: true, collapse },
    })

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-home-search-focused')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Abrir ou fechar menu da campanha' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar busca' }))
    expect(collapse).toHaveBeenCalledTimes(1)
  })

  it('does not render the sidebar trigger for staff in app mode (C102)', () => {
    const { container } = renderTopBar({})

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('app')
    expect(screen.queryByRole('button', { name: 'Abrir ou fechar menu da campanha' })).toBeNull()
  })

  it('renders the sidebar trigger for the leader in app mode (C102)', () => {
    const { container } = render(
      <SidebarProvider>
        <CampaignPageChromeProvider role="leader">
          <CampaignWizardChromeProvider>
            <CampaignHomeSearchChromeProvider>
              <CampaignMobileTopBar />
            </CampaignHomeSearchChromeProvider>
          </CampaignWizardChromeProvider>
        </CampaignPageChromeProvider>
      </SidebarProvider>,
    )

    const topBar = container.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('app')
    expect(screen.getByRole('button', { name: 'Abrir ou fechar menu da campanha' })).toBeTruthy()
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

  it('renders dismiss on every wizard step and never a skip link (B168)', () => {
    renderTopBar({
      wizardChrome: {
        flowTitle: 'Registrar atualização',
        stepKind: 'continue',
        previousHref: '/campanha/acoes/atualizar-votos?municipio=cairu',
        dismissHref: '/campanha',
      },
    })

    expect(screen.getByRole('link', { name: 'Sair da ação' }).getAttribute('href')).toBe(
      '/campanha',
    )
    expect(screen.queryByRole('link', { name: 'Pular' })).toBeNull()
  })

  it('keeps wizard mode when chrome updates between steps', () => {
    const { rerender } = render(
      <SidebarProvider>
        <CampaignPageChromeProvider role="coordinator">
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
        </CampaignPageChromeProvider>
      </SidebarProvider>,
    )

    expect(screen.queryByText('Municípios')).toBeNull()

    rerender(
      <SidebarProvider>
        <CampaignPageChromeProvider role="coordinator">
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
        </CampaignPageChromeProvider>
      </SidebarProvider>,
    )

    const topBar = document.querySelector('[data-slot="campaign-mobile-top-bar"]')
    expect(topBar?.getAttribute('data-mode')).toBe('wizard')
    expect(screen.queryByText('Municípios')).toBeNull()
    expect(screen.getByLabelText('Município em atualização: Cairu')).toBeTruthy()
  })
})
