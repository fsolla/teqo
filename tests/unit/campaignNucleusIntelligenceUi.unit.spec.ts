import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { NucleusIntelligenceDialogShell } from '@/components/campaign/NucleusIntelligenceDialogShell'
import { PrimaryContactCombobox } from '@/components/campaign/PrimaryContactCombobox'
import { VoteEstimateDialog } from '@/components/campaign/VoteEstimateDialog'
import { VoteEstimateDialogShell } from '@/components/campaign/VoteEstimateDialogShell'
import { VoteEstimateCard } from '@/components/campaign/VoteEstimateCard'
import {
  nucleusLeadershipDetailSelect,
  nucleusStaffDetailSelect,
  toNucleusDetailViewModel,
} from '@/utilities/nucleusViewModels'
import { parseNucleusIntelligenceFormData } from '@/utilities/nucleusIntelligenceUi'

class TestResizeObserver {
  observe = () => undefined
  unobserve = () => undefined
  disconnect = () => undefined
}

globalThis.ResizeObserver ??= TestResizeObserver
HTMLElement.prototype.scrollIntoView ??= () => undefined

describe('campaign nucleus intelligence UI', () => {
  afterEach(() => cleanup())

  it('keeps the confirmed estimate visible beside a pending proposal', () => {
    const html = renderToStaticMarkup(
      createElement(VoteEstimateCard, {
        confirmedEstimate: 1200,
        confirmedBy: 'João',
        confirmedAt: '16/07/2026',
        proposedEstimate: 1500,
        proposedBy: 'Maria',
      }),
    )

    expect(html).toContain('1.200 votos')
    expect(html).toContain('Confirmada')
    expect(html).toContain('Sugestão pendente')
    expect(html).toContain('1.500 votos por Maria')
  })

  it('renders refreshed suggestion, direct-edit, and review modes for each role and state', () => {
    const { unmount } = render(
      createElement(VoteEstimateDialog, {
        nucleusId: 12,
        role: 'lideranca',
        confirmedEstimate: 1200,
        proposedEstimate: null,
        confirmAction: async () => ({}),
      }),
    )
    expect(screen.getByRole('button', { name: 'Sugerir nova estimativa' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar confirmada' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar estimativa' })).toBeNull()
    unmount()

    const { unmount: unmountStaff } = render(
      createElement(VoteEstimateDialog, {
        nucleusId: 12,
        role: 'coordenador',
        confirmedEstimate: 1200,
        proposedEstimate: null,
        confirmAction: async () => ({}),
      }),
    )
    expect(screen.getByRole('button', { name: 'Sugerir nova estimativa' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar confirmada' }))
    expect(screen.getByLabelText('Justificativa da alteração *').hasAttribute('required')).toBe(
      true,
    )
    expect(screen.getByRole('button', { name: 'Salvar estimativa' })).toBeTruthy()
    unmountStaff()

    render(
      createElement(VoteEstimateDialog, {
        nucleusId: 12,
        role: 'coordenador',
        confirmedEstimate: 1200,
        proposedEstimate: 1500,
        confirmAction: async () => ({}),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Revisar sugestão' }))
    expect(screen.getByLabelText(/Justificativa do ajuste/).getAttribute('name')).toBe(
      'confirmationNote',
    )
    expect(screen.getByRole('button', { name: 'Confirmar estimativa' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar confirmada' })).toBeNull()
    expect(document.querySelector('[name="expectedProposedVoteEstimateVersion"]')).toBeNull()
  })

  it('restores every available estimate trigger after closing a lazy editor', async () => {
    render(
      createElement(VoteEstimateDialogShell, {
        nucleusId: 12,
        role: 'coordenador',
        confirmedEstimate: 1200,
        proposedEstimate: null,
        confirmAction: async () => ({}),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar confirmada' }))
    expect(await screen.findByLabelText('Justificativa da alteração *')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sugerir nova estimativa' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Editar confirmada' })).toBeTruthy()
    })
  })

  it('renders scoped intelligence editing with accessible field labels', async () => {
    render(
      createElement(NucleusIntelligenceDialogShell, {
        nucleusId: 12,
        intelligence: {
          strengths: [{ text: 'Rede comunitária ativa' }],
          risks: [{ text: 'Deslocamento difícil' }],
          voterProfiles: [
            {
              label: 'Jovens trabalhadores',
              ageRange: '18–29',
              incomeBand: null,
              occupation: 'Serviços',
              localTraits: 'Uso intenso de WhatsApp',
              notes: null,
            },
          ],
          ticketAlliance: {
            partnerName: 'Ana',
            office: 'Deputada estadual',
            isCampaignPartner: true,
            notes: 'Agenda conjunta',
          },
        },
        primaryContact: { id: 8, name: 'Maria', phone: '71999990000' },
        searchPrimaryContacts: async () => ({
          current: { id: 8, name: 'Maria', phone: '71999990000' },
          options: [{ id: 9, name: 'Joana', phone: '71988880000' }],
        }),
      }),
    )

    const trigger = screen.getByRole('button', { name: 'Editar inteligência' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(trigger)
    expect(await screen.findByText('Pontos fortes')).toBeTruthy()
    expect(screen.getByText('Riscos')).toBeTruthy()
    expect(screen.getByText('Perfis do eleitorado')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Contato principal: Maria/ })).toBeTruthy()
    expect(screen.getByDisplayValue('Rede comunitária ativa')).toBeTruthy()
  })

  it('debounces searches and ignores stale primary-contact responses', async () => {
    const resolvers: Array<
      (value: {
        current: { id: number; name: string; phone: string } | null
        options: Array<{ id: number; name: string; phone: string }>
      }) => void
    > = []
    const search = vi.fn(
      () =>
        new Promise<{
          current: { id: number; name: string; phone: string } | null
          options: Array<{ id: number; name: string; phone: string }>
        }>((resolve) => resolvers.push(resolve)),
    )

    render(
      createElement(PrimaryContactCombobox, {
        name: 'primaryContact',
        current: { id: 8, name: 'Maria atual', phone: '71999990000' },
        search,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Contato principal: Maria atual/ }))
    const input = screen.getByRole('combobox', { name: 'Buscar liderança por nome ou celular' })

    await waitFor(() => expect(search).toHaveBeenCalledWith(''))
    resolvers.shift()?.({
      current: { id: 8, name: 'Maria atual', phone: '71999990000' },
      options: [],
    })
    fireEvent.change(input, { target: { value: 'primeira' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('primeira'))
    fireEvent.change(input, { target: { value: 'segunda' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('segunda'))

    const firstResolver = resolvers.shift()
    const secondResolver = resolvers.shift()
    secondResolver?.({
      current: { id: 8, name: 'Maria atual', phone: '71999990000' },
      options: [{ id: 10, name: 'Resposta nova', phone: '71977770000' }],
    })
    await waitFor(() => expect(screen.getByText(/Resposta nova/)).toBeTruthy())
    firstResolver?.({
      current: { id: 8, name: 'Maria atual', phone: '71999990000' },
      options: [{ id: 11, name: 'Resposta obsoleta', phone: '71966660000' }],
    })
    await Promise.resolve()

    expect(screen.queryByText(/Resposta obsoleta/)).toBeNull()
    expect(screen.getAllByText(/Maria atual/)).toHaveLength(2)
    expect(screen.getByText(/Resposta nova/)).toBeTruthy()
  })

  it('parses only allowed intelligence fields from form data', () => {
    const formData = new FormData()
    formData.set('nucleus', '12')
    formData.set('strengths', JSON.stringify([{ text: 'Rede comunitária' }]))
    formData.set('risks', JSON.stringify([{ text: 'Acesso difícil' }]))
    formData.set('voterProfiles', JSON.stringify([{ label: 'Jovens', ageRange: '18–29' }]))
    formData.set('primaryContact', '8')
    formData.set('partnerName', 'Ana')
    formData.set('office', 'Deputada estadual')
    formData.set('isCampaignPartner', 'on')
    formData.set('allianceNotes', 'Agenda conjunta')
    formData.set('confirmedVoteEstimate', '999999')
    formData.set('confirmedVoteEstimateBy', '999')

    expect(parseNucleusIntelligenceFormData(formData)).toEqual({
      id: 12,
      strengths: [{ text: 'Rede comunitária' }],
      risks: [{ text: 'Acesso difícil' }],
      voterProfiles: [{ label: 'Jovens', ageRange: '18–29' }],
      primaryContact: 8,
      ticketAlliance: {
        partnerName: 'Ana',
        office: 'Deputada estadual',
        isCampaignPartner: true,
        notes: 'Agenda conjunta',
      },
    })
  })

  it('preserves omitted arrays and clears only explicit empty arrays', () => {
    const omitted = new FormData()
    omitted.set('nucleus', '12')
    expect(parseNucleusIntelligenceFormData(omitted)).toEqual({ id: 12 })

    const cleared = new FormData()
    cleared.set('nucleus', '12')
    cleared.set('strengths', '[]')
    cleared.set('risks', '[]')
    cleared.set('voterProfiles', '[]')
    expect(parseNucleusIntelligenceFormData(cleared)).toMatchObject({
      strengths: [],
      risks: [],
      voterProfiles: [],
    })
  })

  it('serializes only intelligence fields needed by the overview', () => {
    const view = toNucleusDetailViewModel(
      {
        id: 12,
        name: 'Núcleo seguro',
        slug: 'nucleo-seguro',
        status: 'ativo',
        coordinators: [99],
        regions: ['Chapada Diamantina'],
        cities: ['Seabra'],
        neighborhoods: ['Centro'],
        organizationKind: 'territorial',
        sectorKind: 'rural',
        tseZones: [],
        strengths: [{ text: 'Rede forte' }],
        risks: [{ text: 'Acesso difícil' }],
        voterProfiles: [{ label: 'Jovens', notes: 'Mobilização digital' }],
        ticketAlliance: {
          partnerName: 'Ana',
          notes: 'Agenda conjunta',
        },
        updatedAt: '',
        createdAt: '',
      },
      'geral',
    )
    const serialized = JSON.stringify(view.tabs)

    expect(view.kind).toBe('staff')
    expect(serialized).toContain('Mobilização digital')
    expect(serialized).toContain('Agenda conjunta')
    expect(serialized).not.toContain('coordinators')
    expect(serialized).not.toContain('sectorKind')
    expect(JSON.stringify(nucleusStaffDetailSelect)).not.toContain('coordinators')
    expect(JSON.stringify(nucleusStaffDetailSelect)).toContain('proposedVoteEstimateVersion')
  })

  it('serializes a minimal leadership DTO without strategic intelligence', () => {
    const view = toNucleusDetailViewModel(
      {
        id: 12,
        name: 'Núcleo seguro',
        slug: 'nucleo-seguro',
        status: 'ativo',
        coordinators: [
          {
            id: 99,
            name: 'Coordenação interna',
            role: 'coordenador',
            updatedAt: '',
            createdAt: '',
            collection: 'campaignUser',
          },
        ],
        regions: ['Chapada Diamantina'],
        cities: ['Seabra'],
        neighborhoods: ['Centro'],
        locality: 'Centro',
        territoryNotes: 'Estratégia territorial interna',
        organizationKind: 'territorial',
        organizationLabel: 'Organização local',
        tseZones: [{ zoneNumber: 58 }],
        strengths: [{ text: 'Rede forte sigilosa' }],
        risks: [{ text: 'Risco sigiloso' }],
        voterProfiles: [
          {
            label: 'Jovens',
            ageRange: '18–29',
            incomeBand: 'Interna',
            occupation: 'Interna',
            localTraits: 'Interno',
            notes: 'Mobilização sigilosa',
          },
        ],
        ticketAlliance: {
          partnerName: 'Ana',
          office: 'Deputada',
          isCampaignPartner: true,
          notes: 'Agenda sigilosa',
        },
        confirmedVoteEstimate: 1200,
        confirmedVoteEstimateAt: '2026-07-16T12:00:00.000Z',
        confirmedVoteEstimateBy: {
          id: 99,
          name: 'Coordenação interna',
          role: 'coordenador',
          updatedAt: '',
          createdAt: '',
          collection: 'campaignUser',
        },
        proposedVoteEstimate: 1500,
        proposedVoteEstimateAt: '2026-07-17T12:00:00.000Z',
        proposedVoteEstimateBy: {
          id: 98,
          name: 'Autoria interna',
          role: 'lideranca',
          updatedAt: '',
          createdAt: '',
          collection: 'campaignUser',
        },
        proposedVoteEstimateVersion: '37d7916c-d4a9-4ca3-bd71-cb1c767f6eb5',
        primaryContact: 77,
        updatedAt: '',
        createdAt: '',
      },
      'lideranca',
    )
    const serialized = JSON.stringify(view)

    expect(view).toEqual({
      kind: 'leadership',
      id: 12,
      name: 'Núcleo seguro',
      slug: 'nucleo-seguro',
      status: 'ativo',
      regions: ['Chapada Diamantina'],
      cities: ['Seabra'],
      neighborhoods: ['Centro'],
      locality: 'Centro',
      organizationKind: 'territorial',
      organizationLabel: 'Organização local',
      tseZones: [58],
      confirmedVoteEstimate: 1200,
      tabs: {
        kind: 'leadership',
        regions: ['Chapada Diamantina'],
        cities: ['Seabra'],
        neighborhoods: ['Centro'],
        locality: 'Centro',
        tseZones: [58],
      },
    })
    for (const forbidden of [
      'strengths',
      'risks',
      'voterProfiles',
      'ticketAlliance',
      'territoryNotes',
      'latitude',
      'longitude',
      'radiusKm',
      'proposedVoteEstimate',
      'proposedVoteEstimateVersion',
      'confirmedVoteEstimateAt',
      'confirmedVoteEstimateBy',
      'primaryContact',
      'Coordenação interna',
      'Autoria interna',
      'sigilosa',
    ]) {
      expect(serialized).not.toContain(forbidden)
      expect(JSON.stringify(nucleusLeadershipDetailSelect)).not.toContain(forbidden)
    }
  })
})
