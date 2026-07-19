import { createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { archiveNucleusFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/formActions'
import { ArchiveNucleusDialog } from '@/components/campaign/ArchiveNucleusDialog'
import { getPaginationPages } from '@/components/campaign/CampaignListPagination'
import { NucleusFormFields } from '@/components/campaign/NucleusForm'
import { NucleusList } from '@/components/campaign/NucleusList'
import { NucleusTerritoryAndZonesFields } from '@/components/campaign/NucleusTerritoryAndZonesFields'
import { TseZoneInput } from '@/components/campaign/TseZoneInput'
import { campaignNav, getCampaignNav, isCampaignNavActive } from '@/components/campaign/nav'
import {
  buildNucleusListHref,
  buildNucleusListWhere,
  buildNucleusListVisitHref,
  buildNucleusListVisitLabel,
  getCampaignScopeLabel,
  parseNucleusListParams,
} from '@/utilities/nucleusUi'
import {
  parseNucleusCreateFormData,
  parseNucleusUpdateFormData,
} from '@/utilities/nucleusFormData'
import { nucleusStaffDetailSelect, toNucleusDetailViewModel } from '@/utilities/nucleusViewModels'
import { parseTseZoneNumbers } from '@/utilities/tseZone'
import { matchesAtWordStart } from '@/utilities/wordStartFilter'

describe('campaign nucleus UI contracts', () => {
  afterEach(cleanup)
  it('exposes home, nuclei, action-plan, and supporters navigation scoped by role', () => {
    expect(campaignNav.map(({ href, title }) => ({ href, title }))).toEqual([
      { href: '/campanha', title: 'Início' },
      { href: '/campanha/nucleos', title: 'Núcleos' },
      { href: '/campanha/planos', title: 'Planos' },
      { href: '/campanha/apoiadores', title: 'Apoiadores' },
    ])
    expect(getCampaignNav('geral').map(({ href }) => href)).toEqual([
      '/campanha',
      '/campanha/nucleos',
      '/campanha/planos',
      '/campanha/apoiadores',
    ])
    expect(getCampaignNav('lideranca').map(({ href, title }) => ({ href, title }))).toEqual([
      { href: '/campanha', title: 'Início' },
      { href: '/campanha/nucleos', title: 'Meus núcleos' },
      { href: '/campanha/planos', title: 'Planos' },
    ])
    expect(isCampaignNavActive('/campanha/nucleos/nucleo-chapada', '/campanha/nucleos')).toBe(true)
    expect(isCampaignNavActive('/campanha/nucleos', '/campanha')).toBe(false)
    expect(isCampaignNavActive('/campanha/planos/novo', '/campanha/planos')).toBe(true)
    expect(isCampaignNavActive('/campanha/apoiadores/1', '/campanha/apoiadores')).toBe(true)
  })

  it('normalizes list URL state and rejects unsupported filter values', () => {
    expect(
      parseNucleusListParams({
        page: '-2',
        q: '  Chapada  ',
        city: '  Seabra ',
        region: 'Chapada Diamantina',
        tseZone: '58',
        coverage: 'sem_coordenador',
        estimate: 'confirmada',
      }),
    ).toEqual({
      page: 1,
      q: 'Chapada',
      city: 'Seabra',
      region: 'Chapada Diamantina',
      tseZone: 58,
      coverage: 'sem_coordenador',
      estimate: 'confirmada',
    })

    expect(
      parseNucleusListParams({
        region: 'Região inválida',
        tseZone: '1000',
        coverage: 'invalid',
        estimate: 'invalid',
      }),
    ).toEqual({ page: 1 })
  })

  it('matches territory and city queries only at normalized word starts', () => {
    expect(matchesAtWordStart('Sisal', 'sal')).toBe(false)
    expect(matchesAtWordStart('Cruz das Almas', 'sal')).toBe(false)
    expect(matchesAtWordStart('Sisal', 'sis')).toBe(true)
    expect(matchesAtWordStart('Cruz das Almas', 'alm')).toBe(true)
    expect(matchesAtWordStart('Cruz das Almas', 'das alm')).toBe(true)
    expect(matchesAtWordStart('Vitória da Conquista', 'vitoria')).toBe(true)
    expect(matchesAtWordStart('São Félix', 'fel')).toBe(true)
  })

  it('adds a municipality as a chip via the strict combobox and derives its territory chip', async () => {
    render(createElement(NucleusTerritoryAndZonesFields))
    const city = screen.getByLabelText('Municípios') as HTMLInputElement

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'Seab' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })
    fireEvent.keyDown(city, { key: 'Enter' })

    await waitFor(() => expect(city.value).toBe(''))
    expect(screen.getByText('Seabra')).toBeTruthy()
    expect(screen.getByText('Chapada Diamantina')).toBeTruthy()
    expect(screen.queryByLabelText('Territórios de identidade')).toBeNull()
  })

  it('uses neutral editable lookup identifiers and exposes only the canonical hidden fields', () => {
    const { container } = render(
      createElement(NucleusTerritoryAndZonesFields, {
        fieldErrors: { regions: ['Território inválido.'], cities: ['Município inválido.'] },
      }),
    )
    const region = screen.getByLabelText('Territórios de identidade') as HTMLInputElement
    const city = screen.getByLabelText('Municípios') as HTMLInputElement

    for (const input of [region, city]) {
      expect(input.autocomplete).toBe('off')
      expect(input.getAttribute('autocorrect')).toBe('off')
      expect(input.getAttribute('spellcheck')).toBe('false')
      expect(input.name).toBe('')
      expect(
        [
          input.id,
          input.name,
          input.getAttribute('aria-controls'),
          input.getAttribute('aria-describedby'),
        ].join(' '),
      ).not.toMatch(/territory|region|municipality|city|address/i)
    }
    expect(region.id).toBe('nucleus-lookup-a')
    expect(city.id).toBe('nucleus-lookup-b')
    expect(region.id).not.toBe(city.id)
    expect(container.querySelectorAll('input[type="hidden"][name="cities"]')).toHaveLength(0)
    expect(container.querySelectorAll('input[type="hidden"][name="regions"]')).toHaveLength(0)
    expect(container.querySelectorAll('input[type="hidden"][name="neighborhoods"]')).toHaveLength(
      0,
    )
    expect(region.getAttribute('aria-describedby')).toBe('nucleus-lookup-a-error')
    expect(city.getAttribute('aria-describedby')).toBe('nucleus-lookup-b-error')
    expect(screen.getByText('Território inválido.').id).toBe('nucleus-lookup-a-error')
    expect(screen.getByText('Município inválido.').id).toBe('nucleus-lookup-b-error')
  })

  it('shows only word-start municipality matches', () => {
    render(createElement(NucleusTerritoryAndZonesFields))
    const city = screen.getByLabelText('Municípios')

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'sal' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })

    expect(screen.getByRole('option', { name: 'Salvador' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Salinas da Margarida' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Cruz das Almas' })).toBeNull()
  })

  it('clears an invalid region or city draft on blur and exposes an error', () => {
    render(createElement(NucleusTerritoryAndZonesFields))
    const region = screen.getByLabelText('Territórios de identidade') as HTMLInputElement
    const city = screen.getByLabelText('Municípios') as HTMLInputElement

    fireEvent.change(region, { target: { value: 'Território inventado' } })
    fireEvent.blur(region)
    expect(region.value).toBe('')
    expect(
      screen.getByText('Selecione um território de identidade válido da Bahia.'),
    ).toBeTruthy()

    fireEvent.change(city, { target: { value: 'Município inventado' } })
    fireEvent.blur(city)
    expect(city.value).toBe('')
    expect(screen.getByText('Selecione um município válido da Bahia.')).toBeTruthy()
  })

  it('allows manually adding regions only until a city is selected, after which they become derived', async () => {
    render(createElement(NucleusTerritoryAndZonesFields))
    const region = screen.getByLabelText('Territórios de identidade') as HTMLInputElement
    const city = screen.getByLabelText('Municípios') as HTMLInputElement

    fireEvent.focus(region)
    fireEvent.change(region, { target: { value: 'Itaparica' } })
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    fireEvent.keyDown(region, { key: 'Enter' })
    expect(screen.getByText('Itaparica')).toBeTruthy()

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'Salvador' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })
    fireEvent.keyDown(city, { key: 'Enter' })

    await waitFor(() => expect(screen.queryByLabelText('Territórios de identidade')).toBeNull())
    expect(screen.queryByText('Itaparica')).toBeNull()
    expect(screen.getByText('Metropolitano de Salvador')).toBeTruthy()
  })

  it('derives regions from multiple cities across territories', () => {
    render(createElement(NucleusTerritoryAndZonesFields))
    const city = screen.getByLabelText('Municípios') as HTMLInputElement

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'Seab' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })
    fireEvent.keyDown(city, { key: 'Enter' })

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'Salv' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })
    fireEvent.keyDown(city, { key: 'Enter' })

    expect(screen.getByText('Seabra')).toBeTruthy()
    expect(screen.getByText('Salvador')).toBeTruthy()
    expect(screen.getByText('Chapada Diamantina')).toBeTruthy()
    expect(screen.getByText('Metropolitano de Salvador')).toBeTruthy()
  })

  it('enables neighborhoods only when exactly one city is set, resetting them otherwise', async () => {
    render(
      createElement(NucleusTerritoryAndZonesFields, {
        values: { cities: ['Seabra'], neighborhoods: ['Centro'] },
      }),
    )
    const neighborhood = screen.getByLabelText('Bairros') as HTMLInputElement
    expect(neighborhood.disabled).toBe(false)
    expect(screen.getByText('Centro')).toBeTruthy()

    const city = screen.getByLabelText('Municípios') as HTMLInputElement
    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'Salvador' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })
    fireEvent.keyDown(city, { key: 'Enter' })

    await waitFor(() => expect(neighborhood.disabled).toBe(true))
    expect(screen.queryByText('Centro')).toBeNull()
  })

  it('removes a city chip and re-derives the territory from the remaining cities', async () => {
    render(createElement(NucleusTerritoryAndZonesFields, { values: { cities: ['Seabra', 'Salvador'] } }))
    expect(screen.getByText('Chapada Diamantina')).toBeTruthy()
    expect(screen.getByText('Metropolitano de Salvador')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Remover município Seabra'))

    await waitFor(() => expect(screen.queryByText('Chapada Diamantina')).toBeNull())
    expect(screen.getByText('Metropolitano de Salvador')).toBeTruthy()
    expect(screen.queryByText('Seabra')).toBeNull()
  })

  it('adds multiple neighborhoods via Enter and removes the last one via Backspace', () => {
    render(createElement(NucleusTerritoryAndZonesFields, { values: { cities: ['Seabra'] } }))
    const neighborhood = screen.getByLabelText('Bairros') as HTMLInputElement

    fireEvent.change(neighborhood, { target: { value: 'Centro' } })
    fireEvent.keyDown(neighborhood, { key: 'Enter' })
    fireEvent.change(neighborhood, { target: { value: 'Bairro Novo' } })
    fireEvent.keyDown(neighborhood, { key: 'Enter' })

    expect(screen.getByText('Centro')).toBeTruthy()
    expect(screen.getByText('Bairro Novo')).toBeTruthy()

    fireEvent.keyDown(neighborhood, { key: 'Backspace' })
    expect(screen.queryByText('Bairro Novo')).toBeNull()
    expect(screen.getByText('Centro')).toBeTruthy()
  })

  it('builds an active, scoped Payload query from URL filters', () => {
    expect(
      buildNucleusListWhere({
        page: 1,
        q: '58',
        city: 'Seabra',
        region: 'Chapada Diamantina',
        tseZone: 58,
        coverage: 'com_coordenador',
        estimate: 'sem_confirmacao',
      }),
    ).toEqual({
      and: [
        { status: { equals: 'ativo' } },
        {
          or: [{ name: { contains: '58' } }, { 'tseZones.zoneNumber': { equals: 58 } }],
        },
        { regions: { equals: 'Chapada Diamantina' } },
        { cities: { equals: 'Seabra' } },
        { 'tseZones.zoneNumber': { equals: 58 } },
        { coordinators: { exists: true } },
        { confirmedVoteEstimate: { exists: false } },
      ],
    })
  })

  it('preserves filters while changing pages', () => {
    expect(
      buildNucleusListHref(
        {
          page: 2,
          q: 'Chapada',
          region: 'Chapada Diamantina',
        },
        3,
      ),
    ).toBe('/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&page=3')
  })

  it('builds recent-visit labels only when list filters are active', () => {
    expect(buildNucleusListVisitLabel({ page: 1 })).toBeNull()
    expect(buildNucleusListVisitLabel({ page: 3 })).toBeNull()
    expect(
      buildNucleusListVisitLabel({
        page: 1,
        region: 'Chapada Diamantina',
        city: 'Seabra',
        coverage: 'sem_coordenador',
      }),
    ).toBe('Núcleos · Chapada Diamantina · Seabra · Sem coordenador')
    expect(buildNucleusListVisitLabel({ page: 1, q: 'solla' })).toBe('Núcleos · Busca "solla"')

    const label = buildNucleusListVisitLabel({
      page: 1,
      region: 'Recôncavo',
      city: 'Cruz das Almas',
      q: 'associação comunitária quilombola do recôncavo baiano',
    })
    expect(label).not.toBeNull()
    expect(label!.length).toBeLessThanOrEqual(80)
    expect(label!.endsWith('…')).toBe(true)
  })

  it('builds recent-visit href without page so filtered pages dedupe', () => {
    expect(
      buildNucleusListVisitHref({
        page: 3,
        region: 'Chapada Diamantina',
        q: 'Chapada',
      }),
    ).toBe('/campanha/nucleos?q=Chapada&region=Chapada+Diamantina')
  })

  it('parses the progressive-enhancement create form into domain input', () => {
    const formData = new FormData()
    formData.set('name', 'Núcleo Chapada')
    formData.append('cities', 'Seabra')
    formData.append('neighborhoods', 'Centro')
    formData.set('organizationKind', 'territorial')
    formData.set('tseZones', '58, 59')
    formData.append('coordinators', '12')
    formData.append('coordinators', '13')

    expect(parseNucleusCreateFormData(formData)).toEqual({
      name: 'Núcleo Chapada',
      regions: ['Chapada Diamantina'],
      cities: ['Seabra'],
      neighborhoods: ['Centro'],
      locality: undefined,
      territoryNotes: undefined,
      organizationKind: 'territorial',
      organizationLabel: undefined,
      sectorKind: undefined,
      coordinators: [12, 13],
      tseZones: [{ zoneNumber: 58 }, { zoneNumber: 59 }],
      ticketAlliance: undefined,
    })
  })

  it('keeps explicit clears in update form data', () => {
    const formData = new FormData()
    formData.set('id', '12')
    formData.set('name', 'Núcleo Chapada')
    formData.set('organizationKind', 'territorial')
    formData.set('locality', 'Centro')
    formData.append('coordinators', '99')
    formData.set('tseZones', '')

    const parsed = parseNucleusUpdateFormData(formData)
    expect(parsed).toMatchObject({
      id: 12,
      tseZones: [],
      regions: [],
      cities: [],
      neighborhoods: [],
      locality: 'Centro',
      sectorKind: null,
      organizationLabel: null,
      ticketAlliance: {
        partnerName: null,
        office: null,
        isCampaignPartner: false,
        notes: null,
      },
    })
    expect(parsed).not.toHaveProperty('coordinators')
  })

  it('rejects clearing regions, cities, and locality together', () => {
    const formData = new FormData()
    formData.set('id', '12')
    formData.set('name', 'Núcleo Chapada')
    formData.set('organizationKind', 'territorial')
    formData.set('locality', '')

    expect(() => parseNucleusUpdateFormData(formData)).toThrow(
      'Informe o território de identidade, município ou localidade do núcleo.',
    )
  })

  it('drops neighborhood input when no city is selected', () => {
    const formData = new FormData()
    formData.set('id', '12')
    formData.set('name', 'Núcleo Chapada')
    formData.append('regions', 'Chapada Diamantina')
    formData.append('neighborhoods', 'Centro')
    formData.set('locality', 'Comunidade rural')
    formData.set('organizationKind', 'territorial')

    expect(parseNucleusUpdateFormData(formData).neighborhoods).toEqual([])
  })

  it('offers opt-in TSE zone and sibling city suggestion chips and unions on accept', async () => {
    render(createElement(NucleusTerritoryAndZonesFields))
    const city = screen.getByLabelText('Municípios') as HTMLInputElement

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'Itiruçu' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })
    fireEvent.keyDown(city, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('Itiruçu')).toBeTruthy())
    expect(screen.getByText('Vale do Jiquiriçá')).toBeTruthy()

    const zoneChip = await screen.findByRole('button', {
      name: 'Adicionar zonas TSE de Itiruçu',
    })
    expect(
      screen.getByRole('button', { name: 'Adicionar zonas TSE de Vale do Jiquiriçá' }),
    ).toBeTruthy()

    const expandCities = screen.queryByRole('button', { name: /\+\d+ sugestões/ })
    if (expandCities) fireEvent.click(expandCities)
    const cityChip = await screen.findByRole('button', { name: 'Adicionar município Maracás' })

    fireEvent.click(zoneChip)
    await waitFor(() => expect(screen.getByLabelText('Remover Zona TSE 37')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Adicionar zonas TSE de Itiruçu' })).toBeNull()

    fireEvent.click(cityChip)
    await waitFor(() => expect(screen.getByLabelText('Remover município Maracás')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Adicionar município Maracás' })).toBeNull()
  })

  it('parses Zona TSE tags as sorted unique bounded numbers', () => {
    expect(parseTseZoneNumbers('58, 12 58\n5')).toEqual([5, 12, 58])
    expect(() => parseTseZoneNumbers('58;59')).toThrow('apenas números')
    expect(() => parseTseZoneNumbers('0, 1000')).toThrow('1 a 999')
  })

  it('renders sorted unique Zona TSE tags inside the editable input group', () => {
    const ControlledTseZoneInput = () => {
      const [zones, setZones] = useState([58])
      return createElement(TseZoneInput, { value: zones, onChange: setZones })
    }
    render(createElement(ControlledTseZoneInput))
    const input = screen.getByLabelText('Adicionar Zona TSE')

    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: '58' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const group = input.closest('[data-slot="input-group"]')
    expect(group).not.toBeNull()
    expect(group?.textContent).toContain('12')
    expect(group?.querySelectorAll('[data-slot="badge"]')).toHaveLength(2)
    expect((group?.textContent ?? '').indexOf('12')).toBeLessThan(
      (group?.textContent ?? '').indexOf('58'),
    )
    const remove = screen.getByLabelText('Remover Zona TSE 12')
    expect(remove.textContent).toBe('12')
    expect(remove.querySelector('svg')?.className.baseVal).toContain('size-3')
    fireEvent.click(remove)
    expect(screen.queryByLabelText('Remover Zona TSE 12')).toBeNull()
  })

  it('serializes only fields rendered by nucleus tabs', () => {
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
        voterProfiles: [{ label: 'Jovens', notes: 'Mobilização digital' }],
        ticketAlliance: { partnerName: 'Parceira', notes: 'Agenda conjunta' },
        updatedAt: '',
        createdAt: '',
      },
      'geral',
    )
    const serialized = JSON.stringify(view.tabs)

    expect(serialized).not.toContain('"id"')
    expect(serialized).not.toContain('"name"')
    expect(serialized).not.toContain('"status"')
    expect(serialized).not.toContain('organizationKind')
    expect(serialized).not.toContain('organizationLabel')
    expect(serialized).not.toContain('confirmedVoteEstimate')
    expect(serialized).not.toContain('proposedVoteEstimate')
    expect(serialized).not.toContain('coordinators')
    expect(serialized).not.toContain('sectorKind')
    expect(serialized).toContain('Mobilização digital')
    expect(serialized).toContain('Agenda conjunta')
    expect(JSON.stringify(nucleusStaffDetailSelect)).not.toContain('coordinators')
    expect(JSON.stringify(nucleusStaffDetailSelect)).not.toContain('sectorKind')
    expect(JSON.stringify(nucleusStaffDetailSelect)).toContain('"notes"')
  })

  it('rejects malformed Zona TSE tokens instead of dropping them', () => {
    const formData = new FormData()
    formData.set('name', 'Núcleo Chapada')
    formData.append('cities', 'Seabra')
    formData.set('organizationKind', 'territorial')
    formData.set('tseZones', '58, inválida')

    expect(() => parseNucleusCreateFormData(formData)).toThrow('Zonas TSE')
  })

  it('keeps pagination boundaries compact and valid', () => {
    expect(getPaginationPages(1, 10)).toEqual([1, 2, 10])
    expect(getPaginationPages(10, 10)).toEqual([1, 9, 10])
    expect(getPaginationPages(5, 10)).toEqual([1, 4, 5, 6, 10])
  })

  it('returns a recoverable archive error for an invalid identifier', async () => {
    const formData = new FormData()
    formData.set('id', 'inválido')

    await expect(archiveNucleusFormAction({}, formData)).resolves.toEqual({
      message: 'Não foi possível identificar o núcleo. Atualize a página e tente novamente.',
    })
  })

  it('renders archive as a confirmation dialog trigger', () => {
    const html = renderToStaticMarkup(createElement(ArchiveNucleusDialog, { nucleusId: 12 }))
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('Arquivar')
  })

  it('describes campaign scope by role without leaking hidden nuclei', () => {
    expect(getCampaignScopeLabel('geral', 12)).toBe('12 núcleos ativos')
    expect(getCampaignScopeLabel('coordenador', 3)).toBe('3 núcleos sob sua coordenação')
    expect(getCampaignScopeLabel('lideranca', 2)).toBe('2 núcleos em que você atua')
  })

  it('renders desktop rows and mobile cards from the same scoped result', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusList, {
        nuclei: [
          {
            id: 12,
            name: 'Quilombo Rio das Rãs',
            slug: 'quilombo-rio-das-ras',
            coordinators: [{ id: 2, name: 'João Silva' }],
            regions: ['Velho Chico'],
            cities: ['Bom Jesus da Lapa'],
            neighborhoods: [],
            locality: null,
            organizationKind: 'territorial',
            organizationLabel: null,
            tseZones: [12],
            confirmedVoteEstimate: 1200,
            proposedVoteEstimate: null,
            lastUpdateAt: null,
          },
        ],
      }),
    )

    expect(html).toContain('data-view="desktop-table"')
    expect(html).toContain('data-view="mobile-cards"')
    expect(html).toContain('Quilombo Rio das Rãs')
    expect(html).toContain('ZE 12')
    expect(html).toContain('João Silva')
  })

  it('renders a fully labeled nucleus form with 44px controls', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusFormFields, {
        coordinators: [
          { id: 1, name: 'Coordenação Geral', isCurrent: true },
          { id: 2, name: 'João Silva', isCurrent: false },
        ] as never,
      }),
    )

    expect(html).toContain('Nome do núcleo')
    expect(html).toContain('Territórios de identidade')
    expect(html).toContain('Municípios')
    expect(html).toContain('Zonas TSE')
    expect(html).toContain('Coordenação Geral (você)')
    expect(html).toContain('João Silva')
    expect(html).toContain('min-h-11')
  })

  it('shows no available coordinator only for an empty eligible list', () => {
    const emptyHtml = renderToStaticMarkup(
      createElement(NucleusFormFields, { coordinators: [] }),
    )
    const eligibleHtml = renderToStaticMarkup(
      createElement(NucleusFormFields, {
        coordinators: [{ id: 1, name: 'Coordenação Geral', isCurrent: true }] as never,
      }),
    )

    expect(emptyHtml).toContain('Nenhum coordenador disponível')
    expect(eligibleHtml).not.toContain('Nenhum coordenador disponível')
  })

  it('does not render coordinator controls in the generic edit form', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusFormFields, {
        coordinators: [{ id: 1, name: 'Coordenação Geral', isCurrent: true }] as never,
        nucleus: {
          id: 12,
          name: 'Núcleo Chapada',
          slug: 'nucleo-chapada',
          regions: ['Chapada Diamantina'],
          cities: ['Seabra'],
          neighborhoods: [],
          locality: null,
          territoryNotes: null,
          organizationKind: 'territorial',
          organizationLabel: null,
          sectorKind: null,
          tseZones: [],
          ticketAlliance: null,
        },
      }),
    )

    expect(html).not.toContain('name="coordinators"')
    expect(html).not.toContain('Coordenadores responsáveis')
    expect(html).not.toContain('Coordenação Geral (você)')
  })

  it('keeps campaign form labels text-selectable', () => {
    render(createElement(NucleusFormFields, { coordinators: [] }))
    for (const label of document.querySelectorAll('label')) {
      expect(label.className).not.toContain('select-none')
    }
    expect(
      screen.getByText('Nome do núcleo *', { exact: true }).closest('label')?.getAttribute('for'),
    ).toBe('name')
  })

  it('links structured field errors to invalid controls', () => {
    const html = renderToStaticMarkup(
      createElement(NucleusFormFields, {
        coordinators: [],
        fieldErrors: { name: ['Informe o nome.'], tseZones: ['Zona TSE inválida.'] },
      }),
    )

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="name-error"')
    expect(html).toContain('id="name-error"')
    expect(html).toContain('aria-describedby="tseZones-error"')
  })

})
