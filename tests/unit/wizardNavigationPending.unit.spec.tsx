import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const routerState = vi.hoisted(() => ({
  replace: vi.fn(),
  resolveReplace: null as (() => void) | null,
}))

vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  useRouter: () => ({
    push: vi.fn(),
    replace: (...args: unknown[]) => routerState.replace(...args),
  }),
}))

import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
import { CampaignWizardChromeProvider } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { SidebarProvider } from '@/components/ui/Sidebar'
import { WIZARD_STEP_PENDING_MESSAGE } from '@/lib/campaignWizardCopy'
import { WIZARD_BACK_HISTORY_KEY } from '@/lib/wizardBack'
import { stubMatchMedia } from '../helpers/matchMedia'

const mountWizardNavigation = () =>
  render(
    <SidebarProvider>
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
    routerState.replace.mockReset()
    routerState.resolveReplace = null
    vi.unstubAllGlobals()
  })

  it('dims step content and locks chrome while Voltar navigation is in flight (B114)', async () => {
    routerState.replace.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          routerState.resolveReplace = resolve
        }),
    )

    const historyStack: unknown[] = [null]
    vi.stubGlobal('history', {
      get state() {
        return historyStack[historyStack.length - 1] ?? null
      },
      pushState(state: unknown) {
        historyStack.push(state)
      },
      back() {
        historyStack.pop()
        window.dispatchEvent(new PopStateEvent('popstate', { state: historyStack.at(-1) ?? null }))
      },
    })

    mountWizardNavigation()

    // Shell pushes a synthetic wizard-back mark on mount.
    expect(historyStack.at(-1)).toEqual({ [WIZARD_BACK_HISTORY_KEY]: true })

    const stepBody = screen.getByRole('heading', { level: 1, name: 'Quantos votos?' }).parentElement
    expect(stepBody).not.toBeNull()
    expect(stepBody!.getAttribute('aria-busy')).not.toBe('true')
    expect(stepBody!.getAttribute('data-pending')).toBeNull()

    const backButton = screen.getByRole('button', { name: /Voltar/ })

    await act(async () => {
      fireEvent.click(backButton)
    })

    await waitFor(() => {
      expect(routerState.replace).toHaveBeenCalledWith('/campanha/acoes/atualizar-votos', {
        scroll: true,
      })
    })

    await waitFor(() => {
      expect(stepBody!.getAttribute('aria-busy')).toBe('true')
      expect(stepBody!.getAttribute('data-pending')).toBe('true')
    })
    expect(screen.getByText(WIZARD_STEP_PENDING_MESSAGE)).toBeTruthy()
    expect((backButton as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => {
      expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
    })

    await act(async () => {
      routerState.resolveReplace?.()
    })

    expect(stepBody!.getAttribute('aria-busy')).not.toBe('true')
    expect(stepBody!.getAttribute('data-pending')).toBeNull()
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()
  })
})
