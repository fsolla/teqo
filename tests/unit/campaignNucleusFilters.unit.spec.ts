import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/campanha/nucleos',
  useRouter: () => ({ replace }),
}))

import { NucleusFilters } from '@/components/campaign/NucleusFilters'
import { loadNucleusListPageData } from '@/utilities/nucleusPageData'
import {
  buildNucleusFiltersKey,
  buildNucleusListHref,
  nucleusListParamNames,
  parseNucleusListParams,
  resolveNucleusListUrl,
} from '@/utilities/nucleusUi'

const initialState = {
  page: 3,
  q: 'Chapada',
  region: 'Chapada Diamantina' as const,
  city: 'Seabra',
  tseZone: 58,
  coverage: 'sem_coordenador' as const,
  estimate: 'confirmada' as const,
}

describe('campaign nucleus automatic filters', () => {
  beforeEach(() => {
    replace.mockReset()
  })

  afterEach(cleanup)

  it('applies territory immediately, resets pagination, and clears an incompatible city', async () => {
    render(createElement(NucleusFilters, { state: initialState }))

    const territory = screen.getByLabelText('Território de identidade')
    fireEvent.change(territory, { target: { value: 'Itaparica' } })
    fireEvent.blur(territory)

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        '/campanha/nucleos?q=Chapada&region=Itaparica&tseZone=58&coverage=sem_coordenador&estimate=confirmada',
        { scroll: false },
      ),
    )
    expect((screen.getByLabelText('Município') as HTMLInputElement).value).toBe('')
  })

  it('filters municipalities strictly and applies a valid city without an Apply button', async () => {
    render(createElement(NucleusFilters, { state: initialState }))

    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).toBeNull()
    const city = screen.getByLabelText('Município')
    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'muc' } })
    fireEvent.keyDown(city, { key: 'ArrowDown' })

    expect(screen.getByRole('option', { name: 'Mucugê' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Salvador' })).toBeNull()

    fireEvent.click(screen.getByRole('option', { name: 'Mucugê' }))
    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        '/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&city=Mucug%C3%AA&tseZone=58&coverage=sem_coordenador&estimate=confirmada',
        { scroll: false },
      ),
    )
  })

  it('mounts exactly one filter controls tree with neutral autofill-resistant identifiers', () => {
    render(createElement(NucleusFilters, { state: initialState }))

    expect(screen.getAllByLabelText('Território de identidade')).toHaveLength(1)
    expect(screen.getAllByLabelText('Município')).toHaveLength(1)
    expect(screen.getAllByLabelText('Nº da ZE')).toHaveLength(1)
    expect(screen.getAllByLabelText('Cobertura')).toHaveLength(1)
    expect(screen.getAllByLabelText('Estimativa')).toHaveLength(1)
    expect(screen.getAllByLabelText('Prioridade')).toHaveLength(1)
    const lookups = [
      screen.getByLabelText('Território de identidade'),
      screen.getByLabelText('Município'),
    ] as HTMLInputElement[]
    expect(new Set(lookups.map((input) => input.id))).toHaveProperty('size', lookups.length)

    for (const input of lookups) {
      expect(input.autocomplete).toBe('off')
      expect(input.getAttribute('autocorrect')).toBe('off')
      expect(input.getAttribute('spellcheck')).toBe('false')
      expect(input.name).toBe('')
      expect(input.closest('form')?.getAttribute('autocomplete')).toBe('off')
      expect(
        [
          input.id,
          input.name,
          input.getAttribute('aria-controls'),
          input.getAttribute('aria-describedby'),
        ].join(' '),
      ).not.toMatch(/territory|region|municipality|city|address/i)
    }
  })

  it('uses a 44px semantic mobile disclosure button controlling the single filters tree', () => {
    render(createElement(NucleusFilters, { state: initialState }))

    const button = screen.getByRole('button', { name: 'Filtros' })
    const controlsID = button.getAttribute('aria-controls')
    const controls = controlsID ? document.getElementById(controlsID) : null

    expect(document.querySelector('details')).toBeNull()
    expect(button.className).toContain('min-h-11')
    expect(button.className).toContain('lg:hidden')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(controls).not.toBeNull()
    expect(controls?.className).toContain('hidden')
    expect(controls?.className).toContain('lg:block')

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(controls?.className).toContain('block')
    expect(screen.getAllByLabelText('Território de identidade')).toHaveLength(1)

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(controls?.className).toContain('hidden')
  })

  it('applies selects and valid ZE immediately while preserving the other URL filters', async () => {
    render(createElement(NucleusFilters, { state: initialState }))

    fireEvent.change(screen.getByLabelText('Cobertura'), {
      target: { value: 'com_coordenador' },
    })
    fireEvent.change(screen.getByLabelText('Nº da ZE'), { target: { value: '999' } })
    fireEvent.blur(screen.getByLabelText('Nº da ZE'))

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        '/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&city=Seabra&tseZone=999&coverage=com_coordenador&estimate=confirmada',
        { scroll: false },
      ),
    )
  })

  it.each(['01', '5e1', '58.0', '+58', '-58', ' 58', '58 ', '1000'])(
    'rejects client ZE value %j without replacing the server query',
    (value) => {
    render(createElement(NucleusFilters, { state: initialState }))

    const zone = screen.getByLabelText('Nº da ZE')
      fireEvent.change(zone, { target: { value } })

    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByText('Informe uma Zona Eleitoral de 1 a 999.')).toBeTruthy()
    },
  )

  it('searches and clears filters while preserving the remaining URL state', async () => {
    render(createElement(NucleusFilters, { state: initialState }))

    const search = screen.getByLabelText('Buscar núcleo ou número da Zona TSE')
    fireEvent.change(search, { target: { value: '  Sisal  ' } })
    fireEvent.submit(search.closest('form')!)

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        '/campanha/nucleos?q=Sisal&region=Chapada+Diamantina&city=Seabra&tseZone=58&coverage=sem_coordenador&estimate=confirmada',
        { scroll: false },
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith('/campanha/nucleos?q=Sisal', { scroll: false }),
    )
  })

  it('remounts controlled values from the canonical key on back-forward navigation', () => {
    const view = render(
      createElement(NucleusFilters, {
        key: buildNucleusFiltersKey(initialState),
        state: initialState,
      }),
    )
    fireEvent.change(screen.getByLabelText('Buscar núcleo ou número da Zona TSE'), {
      target: { value: 'Rascunho local' },
    })
    const restoredState = { page: 1, region: 'Itaparica' as const, city: 'Paulo Afonso' }
    view.rerender(
      createElement(NucleusFilters, {
        key: buildNucleusFiltersKey(restoredState),
        state: restoredState,
      }),
    )

    expect(
      (screen.getByLabelText('Território de identidade') as HTMLInputElement).value,
    ).toBe('Itaparica')
    expect((screen.getByLabelText('Município') as HTMLInputElement).value).toBe(
      'Paulo Afonso',
    )
    expect((screen.getByLabelText('Cobertura') as HTMLSelectElement).value).toBe('')
    expect(
      (screen.getByLabelText('Buscar núcleo ou número da Zona TSE') as HTMLInputElement).value,
    ).toBe('')
  })

  it('builds a stable canonical remount key', () => {
    expect(
      buildNucleusFiltersKey({
        ...initialState,
        q: '  Chapada  ',
        region: 'chapada diamantina' as never,
        city: 'seabra',
      }),
    ).toBe(buildNucleusFiltersKey(initialState))
    expect(buildNucleusFiltersKey({ page: 1, city: 'Seabra' })).toBe('city=Seabra')
  })

  it('removes non-canonical state before emitting a client update', async () => {
    render(createElement(NucleusFilters, { state: { page: 1 } }))

    fireEvent.change(screen.getByLabelText('Cobertura'), {
      target: { value: 'com_coordenador' },
    })

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        '/campanha/nucleos?coverage=com_coordenador',
        { scroll: false },
      ),
    )
  })

  it('preserves rapid filter updates in the next canonical URL', async () => {
    render(createElement(NucleusFilters, { state: initialState }))

    fireEvent.change(screen.getByLabelText('Cobertura'), {
      target: { value: 'com_coordenador' },
    })
    fireEvent.change(screen.getByLabelText('Estimativa'), {
      target: { value: 'sem_confirmacao' },
    })

    await waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(
        '/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&city=Seabra&tseZone=58&coverage=com_coordenador&estimate=sem_confirmacao',
        { scroll: false },
      ),
    )
  })

  it('loads the server list and scope from the parsed URL query', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0 })
    const count = vi.fn().mockResolvedValue({ totalDocs: 7 })
    const payload = { find, count }
    const user = { id: 9, role: 'coordenador' }

    const loaded = await loadNucleusListPageData(
      payload as never,
      user as never,
      Promise.resolve({
        q: '58',
        region: 'Chapada Diamantina',
        city: 'Seabra',
        coverage: 'com_coordenador',
        estimate: 'sem_confirmacao',
        tseZone: '58',
        page: '2',
      }),
    )

    expect(loaded.state.page).toBe(2)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'electoralNucleus',
        page: 2,
        user,
        overrideAccess: false,
        where: {
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
        },
      }),
    )
    expect(count).toHaveBeenCalledWith({
      collection: 'electoralNucleus',
      where: { status: { equals: 'ativo' } },
      user,
      overrideAccess: false,
    })
    expect(loaded.scope.totalDocs).toBe(7)
  })
})

describe('campaign nucleus server filter parsing', () => {
  it('defines and enforces the canonical list parameter whitelist', () => {
    expect(nucleusListParamNames).toEqual([
      'q',
      'region',
      'city',
      'tseZone',
      'coverage',
      'estimate',
      'priority',
      'page',
    ])
    expect(
      resolveNucleusListUrl({
        q: 'Chapada',
        sort: 'createdAt',
        territory: 'obsolete',
      }),
    ).toMatchObject({
      href: '/campanha/nucleos?q=Chapada',
      redirectHref: '/campanha/nucleos?q=Chapada',
      state: { page: 1, q: 'Chapada' },
    })
  })

  it('normalizes official geography, search text, ZE, and page into stable order', () => {
    expect(
      resolveNucleusListUrl({
        page: '02',
        estimate: 'confirmada',
        tseZone: '058',
        city: 'mucuge',
        region: 'CHAPADA DIAMANTINA',
        q: '  Núcleo São João  ',
      }),
    ).toEqual({
      href: '/campanha/nucleos?q=N%C3%BAcleo+S%C3%A3o+Jo%C3%A3o&region=Chapada+Diamantina&city=Mucug%C3%AA&estimate=confirmada',
      redirectHref:
        '/campanha/nucleos?q=N%C3%BAcleo+S%C3%A3o+Jo%C3%A3o&region=Chapada+Diamantina&city=Mucug%C3%AA&estimate=confirmada',
      state: {
        page: 1,
        q: 'Núcleo São João',
        region: 'Chapada Diamantina',
        city: 'Mucugê',
        estimate: 'confirmada',
      },
    })
  })

  it('removes multiple invalid, incompatible, duplicate, and obsolete values at once', () => {
    expect(
      resolveNucleusListUrl({
        region: ['Itaparica', 'Chapada Diamantina'],
        city: 'Seabra',
        tseZone: ['58', '59'],
        coverage: 'all',
        estimate: 'pending',
        page: '-4',
        search: 'obsolete',
      }),
    ).toEqual({
      href: '/campanha/nucleos?region=Itaparica&tseZone=58',
      redirectHref: '/campanha/nucleos?region=Itaparica&tseZone=58',
      state: { page: 1, region: 'Itaparica', tseZone: 58 },
    })
  })

  it('does not redirect an already canonical URL or loop after normalization', () => {
    const params = {
      q: 'Núcleo São João',
      region: 'Chapada Diamantina',
      city: 'Mucugê',
      tseZone: '58',
      coverage: 'com_coordenador',
      estimate: 'sem_confirmacao',
      page: '3',
    }
    const resolved = resolveNucleusListUrl(params)

    expect(resolved.redirectHref).toBeUndefined()
    expect(resolveNucleusListUrl(Object.fromEntries(new URL(resolved.href, 'https://teqo.test').searchParams))).toEqual(
      resolved,
    )
  })

  it('redirects valid parameters supplied out of canonical order', () => {
    expect(
      resolveNucleusListUrl({
        page: '2',
        city: 'Seabra',
        region: 'Chapada Diamantina',
        q: 'Chapada',
      }).redirectHref,
    ).toBe(
      '/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&city=Seabra&page=2',
    )
  })

  it('uses the same canonical resolver for out-of-range pagination', () => {
    expect(
      resolveNucleusListUrl(
        {
          q: 'Chapada',
          region: 'Chapada Diamantina',
          page: '9',
        },
        3,
      ),
    ).toMatchObject({
      href: '/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&page=3',
      redirectHref: '/campanha/nucleos?q=Chapada&region=Chapada+Diamantina&page=3',
      state: { page: 3, q: 'Chapada', region: 'Chapada Diamantina' },
    })
  })

  it('canonicalizes an empty or entirely invalid query to the bare route', () => {
    expect(resolveNucleusListUrl({ q: ' ', tseZone: '0', page: 'NaN' })).toEqual({
      href: '/campanha/nucleos',
      redirectHref: '/campanha/nucleos',
      state: { page: 1 },
    })
    expect(resolveNucleusListUrl({})).toEqual({
      href: '/campanha/nucleos',
      redirectHref: undefined,
      state: { page: 1 },
    })
  })

  it.each([
    [{ region: 'Território inventado' }, { page: 1 }],
    [{ city: 'Município inventado' }, { page: 1 }],
    [
      { region: 'Itaparica', city: 'Seabra', page: '3' },
      { page: 3, region: 'Itaparica' },
    ],
    [{ city: 'Seabra' }, { page: 1, city: 'Seabra' }],
    [
      { region: 'chapada diamantina', city: 'mucuge' },
      { page: 1, region: 'Chapada Diamantina', city: 'Mucugê' },
    ],
    [
      { region: 'CHAPADA DIAMANTINA', city: 'MUCUGÊ' },
      { page: 1, region: 'Chapada Diamantina', city: 'Mucugê' },
    ],
  ])('canonicalizes official geography and ignores invalid values', (params, expected) => {
    expect(parseNucleusListParams(params)).toEqual(expected)
  })

  it.each(['0', '000', '01', '1000', '5e1', '58.0', '+58', '-58', ' 58', '58 ', '58x'])(
    'rejects malformed ZE URL value %j',
    (tseZone) => {
      expect(parseNucleusListParams({ tseZone })).toEqual({ page: 1 })
    },
  )

  it.each([
    ['1', 1],
    ['999', 999],
  ])('accepts ZE boundary %s', (tseZone, expected) => {
    expect(parseNucleusListParams({ tseZone })).toEqual({ page: 1, tseZone: expected })
  })

  it('resets a non-decimal page value', () => {
    expect(parseNucleusListParams({ page: '5e1' })).toEqual({ page: 1 })
  })

  it('builds URLs only from canonical official geography', () => {
    expect(
      buildNucleusListHref(
        {
          page: 7,
          region: 'chapada diamantina' as never,
          city: 'mucuge',
          tseZone: Number('5e1'),
        },
        2,
      ),
    ).toBe(
      '/campanha/nucleos?region=Chapada+Diamantina&city=Mucug%C3%AA&tseZone=50&page=2',
    )

    expect(
      buildNucleusListHref(
        {
          page: 1,
          region: 'Itaparica',
          city: 'Seabra',
        },
        1,
      ),
    ).toBe('/campanha/nucleos?region=Itaparica')
  })

  it('never sends invalid geography or ZE text to the Payload loader query', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0 })
    const count = vi.fn().mockResolvedValue({ totalDocs: 0 })

    const loaded = await loadNucleusListPageData(
      { find, count } as never,
      { id: 9, role: 'coordenador' } as never,
      {
        region: 'Inventado',
        city: 'Fora da Bahia',
        tseZone: '58.0',
        page: '5e1',
      },
    )

    expect(loaded.state).toEqual({ page: 1 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        where: { and: [{ status: { equals: 'ativo' } }] },
      }),
    )
  })
})
