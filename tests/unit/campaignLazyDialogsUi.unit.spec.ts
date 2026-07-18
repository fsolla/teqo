import { act, createElement, type ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { NucleusIntelligenceFormState } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusIntelligenceFormActions'
import type { VoteEstimateFormState } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/voteEstimateFormActions'
import { CoordinatorAssignmentDialog } from '@/components/campaign/CoordinatorAssignmentDialog'
import type { CoordinatorAssignmentDialogBody } from '@/components/campaign/CoordinatorAssignmentDialogBody'
import type { LeadershipInviteDialog } from '@/components/campaign/LeadershipInviteDialog'
import { LeadershipInviteDialogShell } from '@/components/campaign/LeadershipInviteDialogShell'
import type { NucleusIntelligenceDialog } from '@/components/campaign/NucleusIntelligenceDialog'
import { NucleusIntelligenceDialogShell } from '@/components/campaign/NucleusIntelligenceDialogShell'
import type { NucleusUpdateForm } from '@/components/campaign/NucleusUpdateForm'
import { NucleusUpdateFormShell } from '@/components/campaign/NucleusUpdateFormShell'
import type { VoteEstimateActionDialog } from '@/components/campaign/VoteEstimateDialog'
import { VoteEstimateDialogShell } from '@/components/campaign/VoteEstimateDialogShell'

const navigation = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
Element.prototype.scrollIntoView = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}))

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

const intelligenceProps = {
  nucleusId: 12,
  intelligence: {
    strengths: [],
    risks: [],
    voterProfiles: [],
    ticketAlliance: null,
  },
  primaryContact: null,
  searchPrimaryContacts: async () => ({ current: null, options: [] }),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('lazy campaign dialog fallbacks', () => {
  it.each([
    {
      label: 'Editar inteligência',
      renderShell: (modulePromise: Promise<{ default: typeof NucleusIntelligenceDialog }>) =>
        render(
          createElement(NucleusIntelligenceDialogShell, {
            ...intelligenceProps,
            loadDialogModule: () => modulePromise,
          }),
        ),
    },
    {
      label: 'Editar confirmada',
      renderShell: (modulePromise: Promise<{ default: typeof VoteEstimateActionDialog }>) =>
        render(
          createElement(VoteEstimateDialogShell, {
            confirmAction: async () => ({}),
            confirmedEstimate: 1200,
            loadDialogModule: () => modulePromise,
            nucleusId: 12,
            proposedEstimate: null,
            role: 'coordenador',
          }),
        ),
    },
    {
      label: 'Nova atualização',
      renderShell: (modulePromise: Promise<{ default: typeof NucleusUpdateForm }>) =>
        render(
          createElement(NucleusUpdateFormShell, {
            action: async () => ({}),
            loadDialogModule: () => modulePromise,
            nucleusId: 12,
          }),
        ),
    },
    {
      label: 'Convidar pelo WhatsApp',
      renderShell: (modulePromise: Promise<{ default: typeof LeadershipInviteDialog }>) =>
        render(
          createElement(LeadershipInviteDialogShell, {
            consentConfigured: true,
            leadershipId: 7,
            loadDialogModule: () => modulePromise,
            supportStatus: 'engajado',
          }),
        ),
    },
  ])(
    'dismisses the $label fallback with Escape and restores its trigger',
    async ({ label, renderShell }) => {
      const moduleDeferred = deferred<{ default: never }>()
      renderShell(moduleDeferred.promise)

      const trigger = screen.getByRole('button', { name: label })
      fireEvent.click(trigger)
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy()
      expect(trigger.isConnected).toBe(true)

      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(screen.getByRole('button', { name: label })).toBe(trigger)
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    },
  )

  it.each([
    {
      label: 'Editar inteligência',
      renderShell: (loadDialogModule: () => Promise<{ default: typeof NucleusIntelligenceDialog }>) =>
        render(
          createElement(NucleusIntelligenceDialogShell, {
            ...intelligenceProps,
            loadDialogModule,
          }),
        ),
    },
    {
      label: 'Editar confirmada',
      renderShell: (loadDialogModule: () => Promise<{ default: typeof VoteEstimateActionDialog }>) =>
        render(
          createElement(VoteEstimateDialogShell, {
            confirmAction: async () => ({}),
            confirmedEstimate: 1200,
            loadDialogModule,
            nucleusId: 12,
            proposedEstimate: null,
            role: 'coordenador',
          }),
        ),
    },
    {
      label: 'Nova atualização',
      renderShell: (loadDialogModule: () => Promise<{ default: typeof NucleusUpdateForm }>) =>
        render(
          createElement(NucleusUpdateFormShell, {
            action: async () => ({}),
            loadDialogModule,
            nucleusId: 12,
          }),
        ),
    },
    {
      label: 'Convidar pelo WhatsApp',
      renderShell: (loadDialogModule: () => Promise<{ default: typeof LeadershipInviteDialog }>) =>
        render(
          createElement(LeadershipInviteDialogShell, {
            consentConfigured: true,
            leadershipId: 7,
            loadDialogModule,
            supportStatus: 'engajado',
          }),
        ),
    },
  ])(
    'recovers the $label module after rejection, close/reopen, and retry',
    async ({ label, renderShell }) => {
      const ReadyDialog = () =>
        createElement(
          'div',
          { role: 'status' },
          createElement('span', null, `${label} carregado`),
        )
      const loadDialogModule = vi
        .fn()
        .mockRejectedValueOnce(new Error('chunk failed'))
        .mockRejectedValueOnce(new Error('chunk failed again'))
        .mockResolvedValueOnce({ default: ReadyDialog })
      const unhandledRejections: unknown[] = []
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        unhandledRejections.push(event.reason)
        event.preventDefault()
      }
      window.addEventListener('unhandledrejection', handleUnhandledRejection)

      try {
        renderShell(loadDialogModule)
        const trigger = screen.getByRole('button', { name: label })

        fireEvent.click(trigger)
        expect((await screen.findByRole('alert')).textContent).toContain(
          'Não foi possível carregar este conteúdo.',
        )
        expect(loadDialogModule).toHaveBeenCalledTimes(1)
        expect(unhandledRejections).toEqual([])

        fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        await waitFor(() => expect(document.activeElement).toBe(trigger))

        fireEvent.click(trigger)
        expect(await screen.findByRole('alert')).toBeTruthy()
        expect(loadDialogModule).toHaveBeenCalledTimes(2)

        fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
        expect(await screen.findByText(`${label} carregado`)).toBeTruthy()
        expect(loadDialogModule).toHaveBeenCalledTimes(3)
        expect(unhandledRejections).toEqual([])
      } finally {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      }
    },
  )
})

describe('coordinator assignment lazy loading', () => {
  it('starts module and options together and ignores a stale closed request', async () => {
    const firstModule = deferred<{
      default: typeof CoordinatorAssignmentDialogBody
    }>()
    const firstOptions = deferred<{
      expectedUpdatedAt: string
      options: Array<{ id: number; isCurrent: boolean; name: string }>
    }>()
    const loadBodyModule = vi.fn(() => firstModule.promise)
    const loadOptions = vi.fn(() => firstOptions.promise)

    render(
      createElement(CoordinatorAssignmentDialog, {
        action: async () => ({}),
        coordinators: [],
        loadBodyModule,
        loadOptions,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Designar coordenadores' }))
    expect(loadBodyModule).toHaveBeenCalledTimes(1)
    expect(loadOptions).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    firstOptions.resolve({
      expectedUpdatedAt: 'stale',
      options: [{ id: 1, isCurrent: false, name: 'Resposta obsoleta' }],
    })
    const actualModule = await import('@/components/campaign/CoordinatorAssignmentDialogBody')
    firstModule.resolve({ default: actualModule.CoordinatorAssignmentDialogBody })
    await act(async () => Promise.resolve())

    expect(screen.queryByText('Resposta obsoleta')).toBeNull()
  })
})

describe('lazy dialog mutation lifecycle', () => {
  it('refreshes intelligence server content after success', async () => {
    const actionResult = deferred<NucleusIntelligenceFormState>()
    const action = vi.fn((state: NucleusIntelligenceFormState, formData: FormData) => {
      void state
      void formData
      return actionResult.promise
    })
    const dialogModule = await import('@/components/campaign/NucleusIntelligenceDialog')

    render(
      createElement(NucleusIntelligenceDialogShell, {
        ...intelligenceProps,
        action,
        loadDialogModule: async () => ({ default: dialogModule.NucleusIntelligenceDialog }),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar inteligência' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar inteligência' }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))

    actionResult.resolve({ message: 'Inteligência salva.', status: 'success' })

    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Editar inteligência' })).toBeTruthy()
  }, 15_000)

  it('keeps vote mutation mounted and prevents a concurrent duplicate after reopen attempt', async () => {
    const firstResult = deferred<VoteEstimateFormState>()
    const confirmAction = vi.fn((state: VoteEstimateFormState, formData: FormData) => {
      void state
      void formData
      return firstResult.promise
    })
    const dialogModule = await import('@/components/campaign/VoteEstimateDialog')

    render(
      createElement(VoteEstimateDialogShell, {
        confirmAction,
        confirmedEstimate: 1200,
        loadDialogModule: async () => ({ default: dialogModule.VoteEstimateActionDialog }),
        nucleusId: 12,
        proposedEstimate: null,
        role: 'coordenador',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar confirmada' }))
    fireEvent.change(await screen.findByLabelText('Estimativa de votos *'), {
      target: { value: '1300' },
    })
    fireEvent.change(screen.getByLabelText('Justificativa da alteração *'), {
      target: { value: 'Nova leitura territorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar estimativa' }))

    await waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1))
    expect((screen.getByRole('button', { name: /Salvando…/ }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar confirmada' })).toBeNull()
    expect(confirmAction).toHaveBeenCalledTimes(1)

    firstResult.resolve({ message: 'Falha esperada.' })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Salvar estimativa' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('focuses the refreshed vote trigger that matches each successful transition', async () => {
    const SuccessDialog = ({
      mode,
      onPendingChange,
      onSuccessClose,
    }: ComponentProps<typeof VoteEstimateActionDialog>) =>
      createElement(
        'button',
        {
          onClick: () => {
            onPendingChange?.(true, mode, false)
            onPendingChange?.(false, mode, true)
            onSuccessClose?.(mode)
          },
          type: 'button',
        },
        'Concluir ação',
      )
    const loadDialogModule = async () => ({ default: SuccessDialog })
    const view = render(
      createElement(VoteEstimateDialogShell, {
        confirmAction: async () => ({}),
        confirmedEstimate: null,
        confirmedEstimateRevision: null,
        fallbackFocusId: 'estimate-heading',
        loadDialogModule,
        nucleusId: 12,
        proposedEstimate: null,
        role: 'coordenador',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sugerir estimativa' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir ação' }))
    view.rerender(
      createElement(VoteEstimateDialogShell, {
        confirmAction: async () => ({}),
        confirmedEstimate: null,
        confirmedEstimateRevision: null,
        fallbackFocusId: 'estimate-heading',
        loadDialogModule,
        nucleusId: 12,
        proposedEstimate: 1300,
        role: 'coordenador',
      }),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Revisar sugestão' })),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Revisar sugestão' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir ação' }))
    view.rerender(
      createElement(VoteEstimateDialogShell, {
        confirmAction: async () => ({}),
        confirmedEstimate: 1300,
        confirmedEstimateRevision: 'confirmed-1',
        fallbackFocusId: 'estimate-heading',
        loadDialogModule,
        nucleusId: 12,
        proposedEstimate: null,
        role: 'coordenador',
      }),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Editar confirmada' }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar confirmada' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir ação' }))
    view.rerender(
      createElement(VoteEstimateDialogShell, {
        confirmAction: async () => ({}),
        confirmedEstimate: 1400,
        confirmedEstimateRevision: 'confirmed-2',
        fallbackFocusId: 'estimate-heading',
        loadDialogModule,
        nucleusId: 12,
        proposedEstimate: null,
        role: 'coordenador',
      }),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Editar confirmada' }),
      ),
    )
  })

  it('focuses the leadership suggestion trigger after a successful private proposal refresh', async () => {
    const SuccessDialog = ({
      mode,
      onPendingChange,
      onSuccessClose,
    }: ComponentProps<typeof VoteEstimateActionDialog>) =>
      createElement(
        'button',
        {
          onClick: () => {
            onPendingChange?.(true, mode, false)
            onPendingChange?.(false, mode, true)
            onSuccessClose?.(mode)
          },
          type: 'button',
        },
        'Concluir ação',
      )
    const loadDialogModule = async () => ({ default: SuccessDialog })
    const view = render(
      createElement(
        'div',
        null,
        createElement('h2', { id: 'estimate-heading', tabIndex: -1 }, 'Estimativa de votos'),
        createElement(VoteEstimateDialogShell, {
          confirmAction: async () => ({}),
          confirmedEstimate: null,
          confirmedEstimateRevision: null,
          fallbackFocusId: 'estimate-heading',
          loadDialogModule,
          nucleusId: 12,
          proposedEstimate: null,
          role: 'lideranca',
        }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sugerir estimativa' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir ação' }))
    view.rerender(
      createElement(
        'div',
        null,
        createElement('h2', { id: 'estimate-heading', tabIndex: -1 }, 'Estimativa de votos'),
        createElement(VoteEstimateDialogShell, {
          confirmAction: async () => ({}),
          confirmedEstimate: null,
          confirmedEstimateRevision: null,
          fallbackFocusId: 'estimate-heading',
          loadDialogModule,
          nucleusId: 12,
          proposedEstimate: null,
          role: 'lideranca',
        }),
      ),
    )

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Sugerir estimativa' }),
      ),
    )
  })
})
