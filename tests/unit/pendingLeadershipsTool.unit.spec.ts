import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { AIToolContext } from '@/lib/ai/types'
import type { CampaignUser } from '@/payload-types'
import { getPendingLeaderships } from '@/utilities/ai/tools/getPendingLeaderships'

import { stub } from '../helpers/stub'

const denied = { error: 'Leitura de dados de lideranças negada.' }

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

const leadershipDoc = (overrides: Record<string, unknown>) => ({
  id: 1,
  contact: 101,
  municipalities: [1],
  supportStatus: 'a_abordar',
  advisors: [],
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

const execute =
  (payload: Payload, user: CampaignUser = coordinator) =>
  (args: unknown) =>
    (getPendingLeaderships(ctxFor(user, payload)) as unknown as ExecutableTool).execute!(args)

const PENDING_STATUS_WHERE = { supportStatus: { in: ['a_abordar', 'em_disputa', 'engajado'] } }

const amargosa = {
  id: 10,
  name: 'Amargosa',
  slug: 'amargosa',
  city: 'Amargosa',
  region: 'Vale do Jiquiriçá',
}

describe('getPendingLeaderships gate (B185)', () => {
  it('denies a leader with the chat-shaped error before any payload query', async () => {
    const payload = untouchablePayload
    await expect(execute(payload, leader)({})).resolves.toEqual(denied)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('lets a coordinator pass and returns the empty staff shape', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = (await execute(scriptedPayload(find))({})) as Record<string, unknown>
    expect(result.total).toBe(0)
    expect(result.liderancas).toEqual([])
    expect(result.truncado).toBe(false)
    expect(result.escopoRestrito).toBe(false)
    expect(result.criterio).toContain('Engajado')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'leadership', overrideAccess: false }),
    )
  })

  it('lets an advisor pass (RBAC atual via access control, não pelo gate)', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = (await execute(scriptedPayload(find), advisor)({})) as Record<string, unknown>
    expect(result.total).toBe(0)
    expect(result.escopoRestrito).toBe(true)
  })
})

describe('getPendingLeaderships pending criterion (B185)', () => {
  it('lists a_abordar/em_disputa e engajado sem pledge; exclui engajado com pledge, qualquer negativo e qualquer lembranca (C119)', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        leadershipDoc({ id: 1, supportStatus: 'a_abordar' }),
        leadershipDoc({ id: 2, supportStatus: 'engajado' }),
        leadershipDoc({ id: 3, supportStatus: 'em_disputa' }),
        leadershipDoc({ id: 4, supportStatus: 'engajado' }),
        leadershipDoc({ id: 5, supportStatus: 'negativo' }),
        leadershipDoc({ id: 6, supportStatus: 'lembranca' }),
      ]),
    )
    find.mockResolvedValueOnce(findResult([{ leadership: 2 }]))
    find.mockResolvedValueOnce(findResult([{ id: 101, name: 'Lider A' }]))
    find.mockResolvedValueOnce(findResult([{ id: 1, name: 'Amargosa', slug: 'amargosa' }]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({})) as {
      total: number
      liderancas: Array<Record<string, unknown>>
    }

    expect(result.total).toBe(3)
    expect(result.liderancas.map((l) => l.id)).toEqual([1, 3, 4])
    const first = result.liderancas[0]!
    expect(first).toMatchObject({
      nome: 'Lider A',
      status: 'A abordar',
      municipios: [{ id: 1, nome: 'Amargosa', slug: 'amargosa' }],
      assessores: [],
    })
    expect(first.ultimaAtualizacao).toBe('2026-08-01T00:00:00.000Z')

    const leadershipCall = find.mock.calls[0]![0] as { where: unknown; sort: unknown }
    expect(leadershipCall.where).toEqual({ and: [PENDING_STATUS_WHERE] })
    expect(leadershipCall.sort).toBe('-updatedAt')

    // Only engaged docs consult the pledge axis; the pledge where carries the
    // same access options as every other read.
    const pledgeCall = find.mock.calls[1]![0] as { where: unknown; overrideAccess: boolean }
    expect(pledgeCall.where).toEqual({ and: [{ leadership: { in: [2, 4] } }] })
    expect(pledgeCall.overrideAccess).toBe(false)
  })

  it('um pledge fora do escopo não satisfaz o eixo do compromisso', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([amargosa]))
    find.mockResolvedValueOnce(findResult([leadershipDoc({ id: 7, supportStatus: 'engajado' })]))
    find.mockResolvedValueOnce(findResult([{ leadership: 7 }]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      scope: 'Vale do Jiquiriça',
    })) as { liderancas: Array<{ id: number }> }

    expect(result.liderancas).toEqual([])

    const pledgeCall = find.mock.calls[2]![0] as { where: unknown }
    expect(pledgeCall.where).toEqual({
      and: [{ leadership: { in: [7] } }, { municipality: { in: [10] } }],
    })
  })

  it('não consulta pledges quando não há lideranças engajadas no escopo', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([leadershipDoc({ id: 1, supportStatus: 'a_abordar' })]))
    find.mockResolvedValueOnce(findResult([{ id: 101, name: 'Lider A' }]))
    find.mockResolvedValue(findResult([{ id: 1, name: 'Amargosa', slug: 'amargosa' }]))

    const result = (await execute(scriptedPayload(find))({})) as {
      liderancas: Array<{ id: number }>
    }

    expect(result.liderancas).toEqual([
      {
        id: 1,
        municipios: [{ id: 1, nome: 'Amargosa', slug: 'amargosa' }],
        assessores: [],
        nome: 'Lider A',
        status: 'A abordar',
        ultimaAtualizacao: '2026-08-01T00:00:00.000Z',
      },
    ])
    expect(find).toHaveBeenCalledTimes(3)
  })
})

describe('getPendingLeaderships scope resolution (B185)', () => {
  it('resolve território com tolerância a acento ("Vale do Jiquiriça" → região canônica)', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([amargosa]))
    find.mockResolvedValueOnce(findResult([leadershipDoc({ id: 7, municipalities: [10] })]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      scope: 'Vale do Jiquiriça',
    })) as { escopo: { tipo: string; nome: string }; liderancas: unknown[] }

    expect(result.escopo).toEqual({ tipo: 'regiao', nome: 'Vale do Jiquiriçá' })
    const scopeCall = find.mock.calls[0]![0] as { where: unknown }
    expect(scopeCall.where).toEqual({ region: { equals: 'Vale do Jiquiriçá' } })
    const leadershipCall = find.mock.calls[1]![0] as { where: unknown }
    expect(leadershipCall.where).toEqual({
      and: [PENDING_STATUS_WHERE, { municipalities: { in: [10] } }],
    })
    expect(result.liderancas).toHaveLength(1)
  })

  it('resolve "Salvador" como cidade agregando as 19 zonas, sem consulta de município', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        {
          id: 11,
          name: 'Salvador ZE 1',
          slug: 'salvador-ze-1',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
        },
        {
          id: 12,
          name: 'Salvador ZE 2',
          slug: 'salvador-ze-2',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
        },
      ]),
    )
    find.mockResolvedValueOnce(findResult([leadershipDoc({ id: 1, municipalities: [11] })]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      scope: 'Salvador',
    })) as { escopo: { tipo: string; nome: string } }

    expect(result.escopo).toEqual({ tipo: 'cidade', nome: 'Salvador (cidade)' })
    const cityCall = find.mock.calls[0]![0] as { where: unknown }
    expect(cityCall.where).toEqual({ city: { equals: 'Salvador' } })
    const leadershipCall = find.mock.calls[1]![0] as { where: unknown }
    expect(leadershipCall.where).toEqual({
      and: [PENDING_STATUS_WHERE, { municipalities: { in: [11, 12] } }],
    })
  })

  it('resolve município por nome canônico', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        {
          id: 30,
          name: 'Feira de Santana',
          slug: 'feira-de-santana',
          city: 'Feira de Santana',
          region: 'Portal do Sertão',
        },
      ]),
    )
    find.mockResolvedValueOnce(findResult([leadershipDoc({ id: 1, municipalities: [30] })]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      scope: 'Feira de Santana',
    })) as { escopo: { tipo: string; nome: string } }

    expect(result.escopo).toEqual({ tipo: 'municipio', nome: 'Feira de Santana' })
    expect((find.mock.calls[0]![0] as { where: unknown }).where).toEqual({
      name: { equals: 'Feira de Santana' },
    })
  })

  it('município real fora do portfólio do assessor devolve lista vazia escopada, sem erro', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(
      scriptedPayload(find),
      advisor,
    )({
      scope: 'Vale do Jiquiriça',
    })) as {
      escopo: { tipo: string; nome: string }
      escopoRestrito: boolean
      total: number
      liderancas: unknown[]
      error?: string
    }

    expect(result.error).toBeUndefined()
    expect(result.escopo).toEqual({ tipo: 'regiao', nome: 'Vale do Jiquiriçá' })
    expect(result.escopoRestrito).toBe(true)
    expect(result.total).toBe(0)
    expect(result.liderancas).toEqual([])
    expect((find.mock.calls[1]![0] as { where: unknown }).where).toEqual({
      and: [PENDING_STATUS_WHERE, { municipalities: { in: [] } }],
    })
  })

  it('escopo desconhecido devolve erro sem consultar lideranças', async () => {
    const find = vi.fn()
    const result = (await execute(scriptedPayload(find))({
      scope: 'Lugar Inexistente',
    })) as { error: string }
    expect(result.error).toContain('Escopo não reconhecido')
    expect(find).not.toHaveBeenCalled()
  })
})

describe('getPendingLeaderships filtros e modos (B185)', () => {
  it('filtro sem_assessor entra no where como ausência de advisors', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([leadershipDoc({ id: 1, advisors: [] })]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      filter: 'sem_assessor',
    })) as { filtroAplicado: { semAssessor: boolean }; liderancas: unknown[] }

    expect(result.filtroAplicado).toEqual({ semAssessor: true })
    const leadershipCall = find.mock.calls[0]![0] as { where: unknown }
    expect(leadershipCall.where).toEqual({
      and: [PENDING_STATUS_WHERE, { advisors: { exists: false } }],
    })
    expect(result.liderancas).toHaveLength(1)
  })

  it('modo municipios_sem_lideranca lista os municípios do escopo sem nenhuma liderança', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        {
          id: 1,
          name: 'Amargosa',
          slug: 'amargosa',
          city: 'Amargosa',
          region: 'Vale do Jiquiriçá',
        },
        { id: 2, name: 'Brejões', slug: 'brejoes', city: 'Brejões', region: 'Vale do Jiquiriçá' },
        {
          id: 3,
          name: 'Cravolândia',
          slug: 'cravolandia',
          city: 'Cravolândia',
          region: 'Vale do Jiquiriçá',
        },
      ]),
    )
    find.mockResolvedValueOnce(findResult([{ municipalities: [1, 2] }, { municipalities: [1] }]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      scope: 'Vale do Jiquiriça',
      mode: 'municipios_sem_lideranca',
    })) as {
      total: number
      criterio: string
      municipios: Array<{ id: number; nome: string; slug: string }>
    }

    expect(result.total).toBe(1)
    expect(result.criterio).toContain('sem nenhuma liderança')
    expect(result.municipios).toEqual([
      {
        id: 3,
        nome: 'Cravolândia',
        slug: 'cravolandia',
        regiao: 'Vale do Jiquiriçá',
        cidade: 'Cravolândia',
      },
    ])
    const coveredCall = find.mock.calls[1]![0] as { where: unknown }
    expect(coveredCall.where).toEqual({ municipalities: { in: [1, 2, 3] } })
  })

  it('modo municipios_sem_lideranca sem escopo consulta todos os municípios do ator', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        {
          id: 1,
          name: 'Amargosa',
          slug: 'amargosa',
          city: 'Amargosa',
          region: 'Vale do Jiquiriçá',
        },
      ]),
    )
    find.mockResolvedValueOnce(findResult([{ municipalities: [1] }]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({
      mode: 'municipios_sem_lideranca',
    })) as { total: number }

    expect(result.total).toBe(0)
    const allCall = find.mock.calls[0]![0] as { collection: string; where: unknown }
    expect(allCall.collection).toBe('municipality')
    expect(allCall.where).toEqual({})
  })

  it('rejeita combinar o filtro sem_assessor com o modo de municípios', async () => {
    const find = vi.fn()
    const result = (await execute(scriptedPayload(find))({
      mode: 'municipios_sem_lideranca',
      filter: 'sem_assessor',
    })) as { error: string }
    expect(result.error).toContain('só se aplica à lista de lideranças')
    expect(find).not.toHaveBeenCalled()
  })

  it('trunca no limite mantendo o total real e devolve a dica de estreitar', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([
        leadershipDoc({ id: 1, supportStatus: 'a_abordar' }),
        leadershipDoc({ id: 2, supportStatus: 'a_abordar' }),
        leadershipDoc({ id: 3, supportStatus: 'a_abordar' }),
      ]),
    )
    find.mockResolvedValueOnce(findResult([]))
    find.mockResolvedValueOnce(findResult([{ id: 101, name: 'Lider A' }]))
    find.mockResolvedValue(findResult([{ id: 1, name: 'Amargosa', slug: 'amargosa' }]))

    const result = (await execute(scriptedPayload(find))({ limit: 2 })) as {
      total: number
      truncado: boolean
      dica?: string
      liderancas: unknown[]
    }

    expect(result.total).toBe(3)
    expect(result.truncado).toBe(true)
    expect(result.dica).toContain('Estreite o escopo')
    expect(result.liderancas).toHaveLength(2)
  })

  it('nomes de assessores são resolvidos em query própria (nunca depth populando campaignUser)', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([leadershipDoc({ id: 1, advisors: [501, 502], supportStatus: 'em_disputa' })]),
    )
    find.mockResolvedValueOnce(findResult([{ id: 101, name: 'Lider A' }]))
    find.mockResolvedValueOnce(findResult([{ id: 1, name: 'Amargosa', slug: 'amargosa' }]))
    find.mockResolvedValueOnce(
      findResult([
        { id: 501, name: 'João Assessor' },
        { id: 502, name: 'Maria Assessora' },
      ]),
    )

    const result = (await execute(scriptedPayload(find))({})) as {
      liderancas: Array<{ assessores: Array<{ id: number; nome: string | null }> }>
    }

    expect(result.liderancas[0]!.assessores).toEqual([
      { id: 501, nome: 'João Assessor' },
      { id: 502, nome: 'Maria Assessora' },
    ])
    const advisorCall = find.mock.calls[3]![0] as { collection: string; select: unknown }
    expect(advisorCall.collection).toBe('campaignUser')
    expect(advisorCall.select).toEqual({ name: true })
  })

  it('municípios fora do acesso são omitidos (nunca um id pelado no chip)', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([leadershipDoc({ id: 1, municipalities: [1, 99], supportStatus: 'a_abordar' })]),
    )
    find.mockResolvedValueOnce(findResult([{ id: 101, name: 'Lider A' }]))
    find.mockResolvedValueOnce(findResult([{ id: 1, name: 'Amargosa', slug: 'amargosa' }]))
    find.mockResolvedValue(findResult([]))

    const result = (await execute(scriptedPayload(find))({})) as {
      liderancas: Array<{ municipios: unknown[] }>
    }

    expect(result.liderancas[0]!.municipios).toEqual([
      { id: 1, nome: 'Amargosa', slug: 'amargosa' },
    ])
  })
})
