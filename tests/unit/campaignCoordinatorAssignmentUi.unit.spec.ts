import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDashboardQueueItemHref } from '@/components/campaign/CampaignDashboard'
import { CoordinatorAssignmentCard } from '@/components/campaign/CoordinatorAssignmentCard'
import { CoordinatorAssignmentDialog } from '@/components/campaign/CoordinatorAssignmentDialog'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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

describe('campaign coordinator assignment UI', () => {
  afterEach(cleanup)

  it('keeps the static card on the server and the picker in a client leaf', () => {
    const cardSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/CoordinatorAssignmentCard.tsx'),
      'utf8',
    )
    const dialogSource = readFileSync(
      resolve(process.cwd(), 'src/components/campaign/CoordinatorAssignmentDialog.tsx'),
      'utf8',
    )

    expect(cardSource).not.toMatch(/^['"]use client['"]/)
    expect(cardSource).not.toContain('eligibleOptions')
    expect(cardSource).toContain('children')
    expect(dialogSource).toMatch(/^'use client'/)
    expect(dialogSource).toContain('loadCoordinatorAssignmentDialogBody')
  })

  it('loads minimal coordinator options only after opening', async () => {
    const loadOptions = vi.fn(async () => ({
      expectedUpdatedAt: '2026-07-17T12:00:00.000Z',
      options: [
        { id: 1, name: 'Coordenação Geral', isCurrent: true },
        { id: 2, name: 'Maria Souza', isCurrent: false },
      ],
    }))

    render(
      createElement(CoordinatorAssignmentDialog, {
        coordinators: [],
        loadOptions,
        action: async () => ({}),
      }),
    )

    expect(loadOptions).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Designar coordenadores' }))
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Coordenação Geral (você)')).toBeTruthy()
    expect(JSON.stringify(loadOptions.mock.results[0]?.value)).not.toContain('phone')
    expect(JSON.stringify(loadOptions.mock.results[0]?.value)).not.toContain('email')
  })

  it('renders privacy-safe contacts without management controls for scoped viewers', () => {
    render(
      createElement(CoordinatorAssignmentCard, {
        coordinators: [{ id: 2, name: 'João Silva', phone: '71999999999' }],
      }),
    )

    expect(screen.getByText('Coordenação responsável')).toBeTruthy()
    expect(screen.getByText('João Silva')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Falar no WhatsApp' }).getAttribute('href')).toBe(
      'https://wa.me/5571999999999',
    )
    expect(screen.queryByRole('button', { name: 'Alterar coordenadores' })).toBeNull()
  })

  it('opens a searchable general-only multi-select with the current actor and 44px controls', async () => {
    render(
      createElement(CoordinatorAssignmentDialog, {
        coordinators: [],
        loadOptions: async () => ({
          expectedUpdatedAt: 'revision',
          options: [
            { id: 1, name: 'Coordenação Geral', isCurrent: true },
            { id: 2, name: 'Maria Souza', isCurrent: false },
          ],
        }),
        action: async () => ({}),
      }),
    )

    const trigger = screen.getByRole('button', { name: 'Designar coordenadores' })
    expect(trigger.className).toContain('min-h-11')
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog')).toBeTruthy()
    const search = await screen.findByLabelText('Buscar coordenadores')
    expect(search).toBeTruthy()
    expect(screen.getByText('Coordenação Geral (você)')).toBeTruthy()
    expect(screen.getByText('Maria Souza')).toBeTruthy()
    const currentActorSelection = screen.getByRole('checkbox', {
      name: 'Coordenação Geral (você)',
    })
    const mariaSelection = screen.getByRole('checkbox', { name: 'Maria Souza' })
    expect(currentActorSelection.tagName).toBe('BUTTON')
    expect(mariaSelection.tagName).toBe('BUTTON')
    expect(currentActorSelection.getAttribute('aria-checked')).toBe('false')
    expect(mariaSelection.getAttribute('aria-checked')).toBe('false')
    expect(currentActorSelection.hasAttribute('aria-selected')).toBe(false)
    expect(mariaSelection.hasAttribute('aria-selected')).toBe(false)

    mariaSelection.focus()
    fireEvent.keyDown(mariaSelection, { key: 'Enter' })
    fireEvent.click(mariaSelection)
    expect(mariaSelection.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(mariaSelection)

    fireEvent.keyDown(mariaSelection, { key: ' ' })
    fireEvent.click(mariaSelection)
    expect(mariaSelection.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(currentActorSelection)
    expect(currentActorSelection.getAttribute('aria-checked')).toBe('true')

    fireEvent.change(search, { target: { value: 'Maria' } })
    expect(screen.queryByRole('checkbox', { name: 'Coordenação Geral (você)' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Maria Souza' })).toBe(mariaSelection)

    expect(screen.getByRole('button', { name: 'Salvar coordenação' }).className).toContain(
      'min-h-11',
    )
  })

  it('exposes persisted coordinator state on the focusable checkbox row', async () => {
    render(
      createElement(CoordinatorAssignmentDialog, {
        coordinators: [{ id: 2, name: 'Maria Souza', phone: null }],
        loadOptions: async () => ({
          expectedUpdatedAt: 'revision',
          options: [
            { id: 1, name: 'Coordenação Geral', isCurrent: true },
            { id: 2, name: 'Maria Souza', isCurrent: false },
          ],
        }),
        action: async () => ({}),
        initialOpen: true,
      }),
    )

    const mariaSelection = await screen.findByRole('checkbox', { name: 'Maria Souza' })
    expect(mariaSelection.tagName).toBe('BUTTON')
    expect(mariaSelection.getAttribute('aria-checked')).toBe('true')
    expect(mariaSelection.className).toContain('focus-visible:ring-3')
  })

  it('shows an honest empty state when no eligible users exist', async () => {
    render(
      createElement(CoordinatorAssignmentDialog, {
        coordinators: [],
        loadOptions: async () => ({ expectedUpdatedAt: 'revision', options: [] }),
        action: async () => ({}),
        initialOpen: true,
      }),
    )

    expect(await screen.findByText('Nenhum usuário elegível disponível')).toBeTruthy()
  })

  it('deep-links only uncovered general-dashboard items into assignment', () => {
    expect(buildDashboardQueueItemHref('nucleo-centro', true)).toBe(
      '/campanha/nucleos/nucleo-centro?assignCoordinators=1',
    )
    expect(buildDashboardQueueItemHref('nucleo-centro', false)).toBe(
      '/campanha/nucleos/nucleo-centro',
    )
  })
})
