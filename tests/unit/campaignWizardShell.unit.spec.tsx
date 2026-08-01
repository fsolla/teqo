import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
import { CampaignWizardChromeProvider } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { SidebarProvider } from '@/components/ui/Sidebar'
import {
  WIZARD_MUNICIPALITY_STEP_TITLE,
  wizardFlowChromeAriaLabel,
} from '@/lib/campaignWizardCopy'
import { stubMatchMedia } from '../helpers/matchMedia'

const renderWizardShell = (props: React.ComponentProps<typeof CampaignWizardShell>) =>
  render(
    <SidebarProvider>
      <CampaignWizardChromeProvider>
        <CampaignMobileTopBar />
        <CampaignWizardShell {...props} />
      </CampaignWizardChromeProvider>
    </SidebarProvider>,
  )

describe('CampaignWizardShell', () => {
  beforeEach(() => {
    stubMatchMedia()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('registers wizard chrome on the mobile top bar for continue steps', () => {
    renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: 'Quantos votos?',
      isEntryStep: false,
      previousHref: '/campanha/acoes/atualizar-votos',
      dismissHref: '/campanha',
      municipalityLabel: 'Cairu',
      children: 'Corpo',
    })

    expect(screen.getByRole('link', { name: /Voltar/ }).getAttribute('href')).toBe(
      '/campanha/acoes/atualizar-votos',
    )
    const topBar = document.querySelector(
      '[data-slot="campaign-mobile-top-bar"][data-mode="wizard"]',
    )
    expect(topBar).toBeTruthy()
    expect(
      within(topBar as HTMLElement).getByLabelText('Município em atualização: Cairu'),
    ).toBeTruthy()
  })

  it('registers entry chrome without back control', () => {
    renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: WIZARD_MUNICIPALITY_STEP_TITLE,
      isEntryStep: true,
      previousHref: '/campanha',
      dismissHref: '/campanha',
      children: 'Corpo',
    })

    expect(screen.getByRole('link', { name: 'Sair da ação' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Voltar/ })).toBeNull()
  })

  it('labels main landmark with the step title', () => {
    const { container } = renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: 'Pergunta',
      isEntryStep: true,
      previousHref: '/campanha',
      children: 'Corpo',
    })

    const main = within(container).getByRole('main')
    const heading = within(container).getByRole('heading', { level: 1, name: 'Pergunta' })
    expect(main.getAttribute('aria-labelledby')).toBe(heading.id)
  })

  it('omits step heading when stepTitle is null and labels main with flow title', () => {
    const { container } = renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: null,
      isEntryStep: true,
      previousHref: '/campanha',
      children: 'Corpo',
    })

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    const main = within(container).getByRole('main')
    expect(main.getAttribute('aria-labelledby')).toBeNull()
    expect(main.getAttribute('aria-label')).toBe(wizardFlowChromeAriaLabel('Ajustar votos'))
  })

  it('uses tighter top padding on mobile when step title is omitted', () => {
    const { container } = renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: null,
      isEntryStep: true,
      previousHref: '/campanha',
      children: null,
    })

    const main = container.querySelector('main')
    expect(main?.className).toMatch(/pt-2/)
    expect(main?.className).not.toMatch(/pt-3/)
    expect(main?.className).toMatch(/pb-6/)
    expect(main?.className).toMatch(/md:py-6/)
  })

  it('moves focus to the step title when stepTitle changes', () => {
    const { rerender } = render(
      <SidebarProvider>
        <CampaignWizardChromeProvider>
          <CampaignMobileTopBar />
          <CampaignWizardShell
            flowTitle="Ajustar votos"
            stepTitle="Passo 1"
            isEntryStep
            previousHref="/campanha"
          >
            Corpo
          </CampaignWizardShell>
        </CampaignWizardChromeProvider>
      </SidebarProvider>,
    )

    rerender(
      <SidebarProvider>
        <CampaignWizardChromeProvider>
          <CampaignMobileTopBar />
          <CampaignWizardShell
            flowTitle="Ajustar votos"
            stepTitle="Passo 2"
            isEntryStep
            previousHref="/campanha"
          >
            Corpo
          </CampaignWizardShell>
        </CampaignWizardChromeProvider>
      </SidebarProvider>,
    )

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Passo 2' }))
  })

  it('shows municipality caption in main on desktop breakpoint classes', () => {
    const { container } = renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: 'Pergunta',
      isEntryStep: false,
      previousHref: '/campanha/acoes/atualizar-votos',
      municipalityLabel: 'Cairu',
      children: null,
    })

    const caption = container.querySelector('main p.md\\:block')
    expect(caption?.textContent).toBe('Cairu')
    expect(caption?.className).toMatch(/md:block/)
  })

  it('uses tighter top padding on mobile main content', () => {
    const { container } = renderWizardShell({
      flowTitle: 'Ajustar votos',
      stepTitle: WIZARD_MUNICIPALITY_STEP_TITLE,
      isEntryStep: true,
      previousHref: '/campanha',
      children: null,
    })

    const main = container.querySelector('main')
    expect(main?.className).toMatch(/pt-3/)
    expect(main?.className).toMatch(/pb-6/)
    expect(main?.className).toMatch(/md:py-6/)
  })
})
