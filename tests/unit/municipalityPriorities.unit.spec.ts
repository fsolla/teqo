import { describe, expect, it } from 'vitest'

import { DAY_MS } from '@/lib/text'
import {
  PRIORITY_POTENTIAL_TOP_N,
  rankMunicipalityPriorities,
  type MunicipalityPriorityItem,
  type PriorityMunicipalityInput,
  type PriorityUpdateSignalInput,
} from '@/utilities/municipality/municipalityPriorities'

const NOW = new Date('2026-08-10T12:00:00.000Z')
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * DAY_MS).toISOString()

const mun = (overrides: Partial<PriorityMunicipalityInput>): PriorityMunicipalityInput => ({
  id: 1,
  name: 'Amargosa',
  slug: 'amargosa',
  region: 'Vale do Jiquiriçá',
  city: 'Amargosa',
  priority: 'normal',
  engagementLevel: null,
  expectedVotesCentral: null,
  validVotes2022: null,
  lastUpdateAt: null,
  politicalTrendStatus: null,
  ...overrides,
})

const update = (
  municipalityID: number,
  createdAt: string,
  overrides: Partial<PriorityUpdateSignalInput> = {},
): PriorityUpdateSignalInput => ({
  municipalityID,
  createdAt,
  polarity: 'ruim',
  urgent: false,
  adversarySignal: false,
  body: null,
  ...overrides,
})

const rank = (
  municipalities: PriorityMunicipalityInput[],
  options: {
    janelaDias?: number
    motivo?: 'sinal_desfavoravel' | 'estagnacao' | 'potencial'
    ordenarPor?: 'gravidade' | 'potencial'
    lastPledgeAtById?: ReadonlyMap<number, string | null>
    updates?: PriorityUpdateSignalInput[]
  } = {},
): MunicipalityPriorityItem[] =>
  rankMunicipalityPriorities(
    municipalities,
    options.lastPledgeAtById ?? new Map(),
    options.updates ?? [],
    {
      windowDays: options.janelaDias ?? 30,
      reason: options.motivo,
      sortBy: options.ordenarPor,
      agora: NOW,
    },
  )

describe('rankMunicipalityPriorities buckets (B186)', () => {
  it('atualização ruim na janela vira sinal_desfavoravel com evidência e trecho', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(2) })], {
      updates: [update(1, daysAgo(2), { body: '  prefeito   fechou  com o adversário  ' })],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 1,
      motivo: 'sinal_desfavoravel',
      ultimoSinalAtrasDias: 2,
    })
    expect(result[0]!.evidencia).toBe(
      'Atualização ruim há 2 dias: "prefeito fechou com o adversário"',
    )
  })

  it('urgente manda sobre a polaridade boa (flags dominam)', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(1) })], {
      updates: [update(1, daysAgo(1), { polarity: 'boa', urgent: true })],
    })

    expect(result[0]!.motivo).toBe('sinal_desfavoravel')
    expect(result[0]!.evidencia).toContain('Atualização urgente há 1 dia')
  })

  it('alerta de adversário tem label próprio', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(3) })], {
      updates: [update(1, daysAgo(3), { polarity: 'neutra', adversarySignal: true })],
    })

    expect(result[0]!.evidencia).toBe('Alerta de adversário há 3 dias')
  })

  it('exclui município com atualização recente favorável e sem sinais negativos', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(1) })], {
      updates: [update(1, daysAgo(1), { polarity: 'boa' })],
    })

    expect(result).toHaveLength(0)
  })

  it('exclusão vale inclusive para o balde potencial (aceite literal)', () => {
    const result = rank(
      [
        mun({
          id: 1,
          lastUpdateAt: daysAgo(1),
          engagementLevel: 'n0',
          expectedVotesCentral: 90000,
        }),
      ],
      { updates: [update(1, daysAgo(1), { polarity: 'boa' })] },
    )

    expect(result).toHaveLength(0)
  })

  it('"última palavra decide": boa recente depois de ruim exclui', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(1) })], {
      updates: [update(1, daysAgo(5)), update(1, daysAgo(1), { polarity: 'boa' })],
    })

    expect(result).toHaveLength(0)
  })

  it('"última palavra decide": ruim recente depois de boa é sinal', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(1) })], {
      updates: [update(1, daysAgo(5), { polarity: 'boa' }), update(1, daysAgo(1))],
    })

    expect(result[0]!.motivo).toBe('sinal_desfavoravel')
  })

  it('atualização fora da janela não é sinal recente; vale a estagnação', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(45) })], {
      updates: [update(1, daysAgo(45))],
    })

    expect(result[0]!.motivo).toBe('estagnacao')
    expect(result[0]!.evidencia).toContain('sem sinal há 45 dias')
  })

  it('sem sinal nenhum é estagnação máxima ("nunca recebeu sinal")', () => {
    const result = rank([mun({ id: 1 })])

    expect(result[0]!.motivo).toBe('estagnacao')
    expect(result[0]!.evidencia).toBe('nunca recebeu sinal')
    expect(result[0]!.ultimoSinalAtrasDias).toBeNull()
  })

  it('pledge recente é sinal (E9): sem atualização mas com compromisso não é estagnação', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: null })], {
      lastPledgeAtById: new Map([[1, daysAgo(2)]]),
    })

    expect(result).toHaveLength(0)
  })

  it('pledge antigo não salva da estagnação', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: null })], {
      lastPledgeAtById: new Map([[1, daysAgo(60)]]),
    })

    expect(result[0]!.motivo).toBe('estagnacao')
    expect(result[0]!.evidencia).toContain('sem sinal há 60 dias')
  })

  it('neutra recente não é estagnação nem sinal; entra no potencial se for top', () => {
    const result = rank(
      [
        mun({
          id: 1,
          lastUpdateAt: daysAgo(1),
          engagementLevel: 'n0',
          expectedVotesCentral: 80000,
        }),
      ],
      { updates: [update(1, daysAgo(1), { polarity: 'neutra' })] },
    )

    expect(result[0]!.motivo).toBe('potencial')
  })

  it('potencial: nível N0 com estimativa central alta entra com evidência rotulada', () => {
    const result = rank([
      mun({ id: 1, lastUpdateAt: daysAgo(2), engagementLevel: 'n0', expectedVotesCentral: 52400 }),
    ])

    expect(result[0]!.motivo).toBe('potencial')
    expect(result[0]!.evidencia).toBe(
      'Potencial alto (estimativa central de 52.400 votos) e nível N0 · Monitorar',
    )
    expect(result[0]).toMatchObject({
      potencialEstimado: 52400,
      fontePotencial: 'estimativa_2026',
      nivelEngajamento: 'N0 · Monitorar',
    })
  })

  it('potencial: sem nível definido entra e a evidência diz "sem nível definido"', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(2), expectedVotesCentral: 40000 })])

    expect(result[0]!.motivo).toBe('potencial')
    expect(result[0]!.evidencia).toBe(
      'Potencial alto (estimativa central de 40.000 votos) e sem nível definido',
    )
    expect(result[0]!.nivelEngajamento).toBe('Sem nível')
  })

  it('potencial: fallback nos válidos 2022 quando não há estimativa central', () => {
    const result = rank([
      mun({ id: 1, lastUpdateAt: daysAgo(2), engagementLevel: 'n1', validVotes2022: 31000 }),
    ])

    expect(result[0]!.motivo).toBe('potencial')
    expect(result[0]!.evidencia).toBe(
      'Potencial alto (31.000 válidos em 2022) e nível N1 · Presença de mandato',
    )
    expect(result[0]).toMatchObject({ fontePotencial: 'validos_2022' })
  })

  it('potencial: engajamento N2+ não é candidato', () => {
    const result = rank([
      mun({ id: 1, lastUpdateAt: daysAgo(2), engagementLevel: 'n2', expectedVotesCentral: 90000 }),
    ])

    expect(result).toHaveLength(0)
  })

  it('potencial: sem número algum de potencial não entra', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(2), engagementLevel: 'n0' })])

    expect(result).toHaveLength(0)
  })

  it(`potencial: corte relativo top ${PRIORITY_POTENTIAL_TOP_N} do escopo`, () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      mun({
        id: index + 1,
        name: `Cidade ${index}`,
        slug: `cidade-${index}`,
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 10000 + index,
      }),
    )
    const result = rank(candidates)

    expect(result).toHaveLength(PRIORITY_POTENTIAL_TOP_N)
    expect(result.map((item) => item.id)).toEqual([8, 7, 6, 5, 4])
  })
})

describe('rankMunicipalityPriorities ordering (B186)', () => {
  it('gravidade: sinal_desfavoravel > estagnacao > potencial', () => {
    const result = rank(
      [
        mun({
          id: 1,
          lastUpdateAt: daysAgo(5),
          engagementLevel: 'n0',
          expectedVotesCentral: 90000,
        }),
        mun({ id: 2, lastUpdateAt: daysAgo(2) }),
        mun({ id: 3, lastUpdateAt: daysAgo(40) }),
      ],
      {
        updates: [update(2, daysAgo(2))],
      },
    )

    expect(result.map((item) => item.motivo)).toEqual([
      'sinal_desfavoravel',
      'estagnacao',
      'potencial',
    ])
  })

  it('dentro do sinal: mais recente primeiro', () => {
    const result = rank(
      [
        mun({ id: 1, name: 'A', lastUpdateAt: daysAgo(2) }),
        mun({ id: 2, name: 'B', lastUpdateAt: daysAgo(1) }),
      ],
      { updates: [update(1, daysAgo(2)), update(2, daysAgo(1))] },
    )

    expect(result.map((item) => item.id)).toEqual([2, 1])
  })

  it('dentro da estagnação: mais frio primeiro, nunca-sinal no topo', () => {
    const result = rank([
      mun({ id: 1, name: 'A', lastUpdateAt: daysAgo(35) }),
      mun({ id: 2, name: 'B', lastUpdateAt: null }),
      mun({ id: 3, name: 'C', lastUpdateAt: daysAgo(90) }),
    ])

    expect(result.map((item) => item.id)).toEqual([2, 3, 1])
  })

  it('dentro do potencial: maior potencial primeiro; prioridade alta desempata', () => {
    const result = rank([
      mun({
        id: 1,
        name: 'A',
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 50000,
      }),
      mun({
        id: 2,
        name: 'B',
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 50000,
        priority: 'alta',
      }),
      mun({
        id: 3,
        name: 'C',
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 80000,
      }),
    ])

    expect(result.map((item) => item.id)).toEqual([3, 2, 1])
  })

  it('prioridade alta aparece na evidência', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(40), priority: 'alta' })])

    expect(result[0]!.evidencia).toBe('sem sinal há 40 dias · prioritário')
  })

  it('tendência política desfavorável entra como cláusula secundária', () => {
    const result = rank([
      mun({ id: 1, lastUpdateAt: daysAgo(40), politicalTrendStatus: 'desfavoravel' }),
    ])

    expect(result[0]!.evidencia).toBe('sem sinal há 40 dias · tendência política desfavorável')
  })

  it('trecho longo é truncado com reticências', () => {
    const longBody = 'x'.repeat(300)
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(1) })], {
      updates: [update(1, daysAgo(1), { body: longBody })],
    })

    expect(result[0]!.evidencia).toMatch(/^Atualização ruim há 1 dia: "x{200}…"$/)
  })
})

describe('rankMunicipalityPriorities options (B186)', () => {
  it('motivo filtra para um único balde', () => {
    const result = rank(
      [
        mun({ id: 1, lastUpdateAt: daysAgo(1) }),
        mun({ id: 2, lastUpdateAt: daysAgo(40) }),
        mun({
          id: 3,
          lastUpdateAt: daysAgo(2),
          engagementLevel: 'n0',
          expectedVotesCentral: 50000,
        }),
      ],
      {
        updates: [update(1, daysAgo(1))],
        motivo: 'estagnacao',
      },
    )

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(2)
  })

  it('ordenarPor potencial reordena todos os baldes por potencial desc', () => {
    const result = rank(
      [
        mun({ id: 1, name: 'A', lastUpdateAt: daysAgo(40), expectedVotesCentral: 30000 }),
        mun({ id: 2, name: 'B', lastUpdateAt: daysAgo(1), expectedVotesCentral: 90000 }),
        mun({ id: 3, name: 'C', lastUpdateAt: daysAgo(45), expectedVotesCentral: null }),
      ],
      {
        updates: [update(2, daysAgo(1))],
        ordenarPor: 'potencial',
      },
    )

    expect(result.map((item) => item.id)).toEqual([2, 1, 3])
  })

  it('janela custom muda a fronteira da estagnação e do sinal', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(40) })], {
      janelaDias: 60,
      updates: [update(1, daysAgo(40))],
    })

    expect(result[0]!.motivo).toBe('sinal_desfavoravel')

    const result2 = rank([mun({ id: 2, lastUpdateAt: daysAgo(40) })], { janelaDias: 30 })
    expect(result2[0]!.motivo).toBe('estagnacao')
  })

  it('fronteira exata da janela: atualização com exatamente 30 dias ainda é decisiva', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(30) })], {
      updates: [update(1, daysAgo(30))],
    })

    expect(result[0]!.motivo).toBe('sinal_desfavoravel')

    const result2 = rank([mun({ id: 2, lastUpdateAt: daysAgo(31) })], {
      updates: [update(2, daysAgo(31))],
    })
    expect(result2[0]!.motivo).toBe('estagnacao')
  })

  it('estagnação: sinal com exatamente 30 dias está no limite (>= janela)', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(30) })])
    expect(result[0]!.motivo).toBe('estagnacao')
  })
})

describe('rankMunicipalityPriorities tiebreaks (B186)', () => {
  it('dois municípios nunca-sinal: prioridade alta primeiro, depois nome (Infinity não vira NaN)', () => {
    const result = rank([
      mun({ id: 1, name: 'Abreu e Lima', slug: 'a', priority: 'normal' }),
      mun({ id: 2, name: 'Belmonte', slug: 'b', priority: 'alta' }),
      mun({ id: 3, name: 'Cairu', slug: 'c', priority: 'normal' }),
    ])

    expect(result.map((item) => item.id)).toEqual([2, 1, 3])
  })

  it('candidatos empatados em potencial ordenam por nome', () => {
    const result = rank([
      mun({
        id: 1,
        name: 'Zé Ninguém',
        slug: 'z',
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 50000,
      }),
      mun({
        id: 2,
        name: 'Alfa',
        slug: 'a',
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 50000,
      }),
      mun({
        id: 3,
        name: 'Beta',
        slug: 'b',
        lastUpdateAt: daysAgo(2),
        engagementLevel: 'n0',
        expectedVotesCentral: 90000,
      }),
    ])

    expect(result.map((item) => item.id)).toEqual([3, 2, 1])
  })

  it('exclusão vence a estagnação: atualização boa recente com pledge antigo fica fora', () => {
    const result = rank([mun({ id: 1, lastUpdateAt: daysAgo(2) })], {
      lastPledgeAtById: new Map([[1, daysAgo(40)]]),
      updates: [update(1, daysAgo(2), { polarity: 'boa' })],
    })

    expect(result).toHaveLength(0)
  })
})
