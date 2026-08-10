import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { AIToolContext } from '@/lib/ai/types'
import type { CampaignUser } from '@/payload-types'
import { getMunicipalityPriorities } from '@/utilities/ai/tools/getMunicipalityPriorities'

import { stub } from '../helpers/stub'

const denied = { error: 'Leitura de prioridades de municípios negada.' }

type FindMock = ReturnType<typeof vi.fn>

const findResult = (docs: unknown[]) => ({ docs })

const ctxFor = (user: CampaignUser, payload: Payload): AIToolContext => ({ user, payload })

const leader = stub<CampaignUser>({ collection: 'campaignUser', role: 'leader' })
const coordinator = stub<CampaignUser>({ collection: 'campaignUser', role: 'coordinator' })
const advisor = stub<CampaignUser>({ collection: 'campaignUser', role: 'advisor' })

const scriptedPayload = (find: FindMock): Payload =>
  stub<Payload>({ find: find as Payload['find'] })

const untouchablePayload = scriptedPayload(
  vi.fn(() => {
    throw new Error('gate must fail closed before any payload query')
  }),
)

const municipalityDoc = (overrides: Record<string, unknown>) => ({
  id: 10,
  name: 'Amargosa',
  slug: 'amargosa',
  city: 'Amargosa',
  region: 'Vale do Jiquiriçá',
  priority: 'normal',
  engagementLevel: null,
  expectedVotes: null,
  lastUpdateAt: null,
  politicalTrend: null,
  ...overrides,
})

const updateDoc = (overrides: Record<string, unknown>) => ({
  municipality: 10,
  createdAt: '2026-08-08T12:00:00.000Z',
  polarity: 'ruim',
  urgent: false,
  adversarySignal: false,
  body: 'prefeito fechou com o adversário',
  ...overrides,
})

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

const execute =
  (payload: Payload, user: CampaignUser = coordinator) =>
  (args: unknown) =>
    (getMunicipalityPriorities(ctxFor(user, payload)) as unknown as ExecutableTool).execute!(args)

describe('getMunicipalityPriorities gate (B186)', () => {
  it('denies a leader with the chat-shaped error before any payload query', async () => {
    const payload = untouchablePayload
    await expect(execute(payload, leader)({})).resolves.toEqual(denied)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('lets a coordinator pass and returns the empty staff shape', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = (await execute(scriptedPayload(find))({})) as Record<string, unknown>

    expect(result.total).toBe(0)
    expect(result.prioridades).toEqual([])
    expect(result.truncado).toBe(false)
    expect(result.escopoRestrito).toBe(false)
    expect(result.escopo).toEqual({ tipo: 'todos', nome: null })
    expect(result.janelaDias).toBe(30)
    expect(result.motivoAplicado).toBeNull()
    expect(result.criterio).toContain('30 dias')
    const munCall = find.mock.calls[0]![0] as { collection: string; overrideAccess: boolean }
    expect(munCall.collection).toBe('municipality')
    expect(munCall.overrideAccess).toBe(false)
    expect(find).toHaveBeenCalledTimes(1)
  })

  it('lets an advisor pass (RBAC atual via access control, não pelo gate)', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = (await execute(scriptedPayload(find), advisor)({})) as Record<string, unknown>
    expect(result.total).toBe(0)
    expect(result.escopoRestrito).toBe(true)
  })
})

describe('getMunicipalityPriorities reads (B186)', () => {
  it('carrega municípios do escopo, atualizações da janela e agregado de pledges com acesso do ator', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        municipalityDoc({ id: 10, expectedVotes: { central: 52400 }, engagementLevel: 'n0' }),
        municipalityDoc({
          id: 11,
          name: 'Brejões',
          slug: 'brejoes',
          lastUpdateAt: '2026-06-01T12:00:00.000Z',
        }),
      ]),
    )
    find.mockResolvedValueOnce(findResult([updateDoc({ municipality: 10 })]))
    find.mockResolvedValueOnce(
      findResult([
        { municipality: 11, declaredVotes: 300, declaredAt: '2026-07-01T12:00:00.000Z' },
      ]),
    )

    const result = (await execute(scriptedPayload(find))({})) as {
      total: number
      prioridades: Array<Record<string, unknown>>
    }

    const munCall = find.mock.calls[0]![0] as { where: unknown }
    expect(munCall.where).toEqual({})

    const updateCall = find.mock.calls[1]![0] as {
      collection: string
      where: { and: unknown[] }
      overrideAccess: boolean
      sort: string
    }
    expect(updateCall.collection).toBe('municipalityUpdate')
    expect(updateCall.where.and).toHaveLength(2)
    expect(updateCall.where.and[0]).toEqual({ municipality: { in: [10, 11] } })
    expect(updateCall.where.and[1]).toEqual({
      createdAt: { greater_than: expect.any(String) } as unknown,
    })
    expect(updateCall.overrideAccess).toBe(false)
    expect(updateCall.sort).toBe('-createdAt')

    const pledgeCall = find.mock.calls[2]![0] as { collection: string; where: unknown }
    expect(pledgeCall.collection).toBe('votePledge')
    expect(pledgeCall.where).toEqual({ municipality: { in: [10, 11] } })

    // The ranking ran with the loaded data: 10 via potential, 11 via stagnation.
    expect(result.total).toBe(2)
    expect(result.prioridades.map((p) => p.motivo)).toEqual(['sinal_desfavoravel', 'estagnacao'])
    const first = result.prioridades[0]!
    expect(first).toMatchObject({
      id: 10,
      nome: 'Amargosa',
      slug: 'amargosa',
      motivo: 'sinal_desfavoravel',
      prioridade: 'normal',
    })
    expect(first.evidencia).toContain('prefeito fechou com o adversário')
    expect(first.ultimaAtualizacao).toBeNull()
  })

  it('escopo região resolve antes das leituras e estreita o where', async () => {
    const find = vi.fn()
    const doc = municipalityDoc({
      id: 10,
      lastUpdateAt: '2026-08-08T12:00:00.000Z',
      engagementLevel: 'n2',
    })
    find.mockResolvedValueOnce(findResult([doc]))
    find.mockResolvedValueOnce(findResult([doc]))
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValueOnce(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      scope: 'Vale do Jiquiriça',
    })) as { escopo: { tipo: string; nome: string }; total: number }

    expect(result.escopo).toEqual({ tipo: 'regiao', nome: 'Vale do Jiquiriçá' })
    const scopeCall = find.mock.calls[0]![0] as { where: unknown }
    expect(scopeCall.where).toEqual({ region: { equals: 'Vale do Jiquiriçá' } })
    const munCall = find.mock.calls[1]![0] as { where: unknown }
    expect(munCall.where).toEqual({ id: { in: [10] } })
    const updateCall = find.mock.calls[2]![0] as { where: { and: unknown[] } }
    expect(updateCall.where.and[0]).toEqual({ municipality: { in: [10] } })
    // Fresh signal, low potential and no engagement → no bucket.
    expect(result.total).toBe(0)
  })

  it('escopo desconhecido devolve erro sem consultar nada', async () => {
    const find = vi.fn()
    const result = (await execute(scriptedPayload(find))({
      scope: 'Lugar Inexistente',
    })) as { error: string }
    expect(result.error).toContain('Escopo não reconhecido')
    expect(find).not.toHaveBeenCalled()
  })

  it('sem municípios no escopo (assessor fora do portfólio) não consulta atualizações nem pledges', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = (await execute(
      scriptedPayload(find),
      advisor,
    )({
      scope: 'Salvador',
    })) as { escopoRestrito: boolean; total: number }

    expect(result.escopoRestrito).toBe(true)
    expect(result.total).toBe(0)
    expect(find).toHaveBeenCalledTimes(1)
  })

  it('aplica limite com total real e devolve a dica de estreitar', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        municipalityDoc({ id: 1, name: 'A', slug: 'a', lastUpdateAt: '2026-06-01T12:00:00.000Z' }),
        municipalityDoc({ id: 2, name: 'B', slug: 'b', lastUpdateAt: '2026-06-02T12:00:00.000Z' }),
      ]),
    )
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValueOnce(findResult([]))

    const result = (await execute(scriptedPayload(find))({ limit: 1 })) as {
      total: number
      truncado: boolean
      dica?: string
      prioridades: unknown[]
    }

    expect(result.total).toBe(2)
    expect(result.truncado).toBe(true)
    expect(result.dica).toContain('Estreite o escopo')
    expect(result.prioridades).toHaveLength(1)
  })

  it('passa motivo, ordenação e janela custom ao ranking', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([municipalityDoc({ id: 1, lastUpdateAt: '2026-06-01T12:00:00.000Z' })]),
    )
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValueOnce(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      reason: 'estagnacao',
      sortBy: 'potencial',
      days: 60,
      limit: 3,
    })) as {
      motivoAplicado: string | null
      janelaDias: number
      criterio: string
      prioridades: unknown[]
    }

    expect(result.motivoAplicado).toBe('estagnacao')
    expect(result.janelaDias).toBe(60)
    expect(result.criterio).toContain('60 dias')
    expect(result.prioridades).toHaveLength(1)
    const updateCall = find.mock.calls[1]![0] as { where: { and: unknown[] } }
    const createdAtClause = updateCall.where.and[1] as { createdAt: { greater_than: string } }
    const cutoffMs = new Date(createdAtClause.createdAt.greater_than).getTime()
    const expectedCutoffMs = Date.now() - 60 * 86_400_000
    expect(Math.abs(cutoffMs - expectedCutoffMs)).toBeLessThan(5_000)
  })

  it('fallback dos válidos 2022 alimenta o potencial quando não há estimativa', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        municipalityDoc({
          id: 10,
          engagementLevel: 'n1',
          expectedVotes: null,
          lastUpdateAt: '2026-08-08T12:00:00.000Z',
        }),
      ]),
    )
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValueOnce(findResult([]))

    const result = (await execute(scriptedPayload(find))({})) as {
      prioridades: Array<{ evidencia: string; fontePotencial: string | null }>
    }

    // "Amargosa" is a real catalog municipality — its 2022 valid votes come
    // from the committed artifact; a non-catalog slug would yield null.
    expect(result.prioridades[0]!.fontePotencial).toBe('validos_2022')
    expect(result.prioridades[0]!.evidencia).toContain('válidos em 2022')
  })
})
