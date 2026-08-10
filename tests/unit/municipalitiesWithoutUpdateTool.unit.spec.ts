import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { AIToolContext } from '@/lib/ai/types'
import { DAY_MS } from '@/lib/text'
import type { CampaignUser } from '@/payload-types'
import { getMunicipalitiesWithoutUpdate } from '@/utilities/ai/tools/getMunicipalitiesWithoutUpdate'

import { stub } from '../helpers/stub'

const denied = { error: 'Leitura de municípios negada.' }

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
  id: 1,
  name: 'Amargosa',
  slug: 'amargosa',
  city: 'Amargosa',
  region: 'Vale do Jiquiriçá',
  kind: 'municipio',
  lastUpdateAt: null,
  advisors: [],
  ...overrides,
})

const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

const execute =
  (payload: Payload, user: CampaignUser = coordinator) =>
  (args: unknown) =>
    (getMunicipalitiesWithoutUpdate(ctxFor(user, payload)) as unknown as ExecutableTool).execute!(
      args,
    )

const run = async (
  find: FindMock,
  args: unknown,
  user: CampaignUser = coordinator,
): Promise<Record<string, unknown>> =>
  (await execute(scriptedPayload(find), user)(args)) as Record<string, unknown>

describe('getMunicipalitiesWithoutUpdate gate (B189)', () => {
  it('denies a leader with the chat-shaped error before any payload query', async () => {
    const payload = untouchablePayload
    await expect(execute(payload, leader)({})).resolves.toEqual(denied)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('lets a coordinator pass and returns the empty staff shape', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = await run(find, {})
    expect(result.total).toBe(0)
    expect(result.municipios).toEqual([])
    expect(result.escopoRestrito).toBe(false)
    expect(result.limiarDias).toBe(30)
    expect(result.criterio).toContain('há mais de 30 dias')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'municipality',
        where: {},
        overrideAccess: false,
      }),
    )
  })

  it('lets an advisor pass (RBAC atual via access control, não pelo gate)', async () => {
    const find = vi.fn().mockResolvedValue(findResult([]))
    const result = await run(find, {}, advisor)
    expect(result.total).toBe(0)
    expect(result.escopoRestrito).toBe(true)
  })
})

describe('getMunicipalitiesWithoutUpdate coverage criterion (B189)', () => {
  it('includes never-updated (top) and municipalities older than the threshold; excludes fresher ones', async () => {
    const find = vi
      .fn()
      .mockResolvedValue(
        findResult([
          municipalityDoc({ id: 1, lastUpdateAt: null, name: 'Nunca' }),
          municipalityDoc({ id: 2, lastUpdateAt: daysAgo(40), name: 'Velho' }),
          municipalityDoc({ id: 3, lastUpdateAt: daysAgo(31), name: 'Borda incluída' }),
          municipalityDoc({ id: 4, lastUpdateAt: daysAgo(30), name: 'Borda excluída' }),
          municipalityDoc({ id: 5, lastUpdateAt: daysAgo(5), name: 'Fresco' }),
        ]),
      )

    const result = await run(find, {})
    const ids = (result.municipios as Array<{ id: number }>).map((m) => m.id)

    expect(result.total).toBe(3)
    expect(result.nuncaAtualizados).toBe(1)
    expect(ids).toEqual([1, 2, 3])
  })

  it('respects a custom threshold from the question (strictly greater)', async () => {
    const find = vi
      .fn()
      .mockResolvedValue(
        findResult([
          municipalityDoc({ id: 1, lastUpdateAt: daysAgo(20) }),
          municipalityDoc({ id: 2, lastUpdateAt: daysAgo(16) }),
          municipalityDoc({ id: 3, lastUpdateAt: daysAgo(15) }),
          municipalityDoc({ id: 4, lastUpdateAt: daysAgo(14) }),
        ]),
      )

    const result = await run(find, { days: 15 })
    const ids = (result.municipios as Array<{ id: number }>).map((m) => m.id)
    expect(ids).toEqual([1, 2])
    expect(result.limiarDias).toBe(15)
    expect(result.criterio).toContain('há mais de 15 dias')
  })

  it('orders never-updated first (by name), then oldest to newest (by name as tie-break)', async () => {
    const find = vi
      .fn()
      .mockResolvedValue(
        findResult([
          municipalityDoc({ id: 1, lastUpdateAt: daysAgo(40), name: 'Beta' }),
          municipalityDoc({ id: 2, lastUpdateAt: null, name: 'Zulu' }),
          municipalityDoc({ id: 3, lastUpdateAt: daysAgo(40), name: 'Alpha' }),
          municipalityDoc({ id: 4, lastUpdateAt: null, name: 'Mike' }),
          municipalityDoc({ id: 5, lastUpdateAt: daysAgo(32), name: 'Gama' }),
        ]),
      )

    const result = await run(find, {})
    const names = (result.municipios as Array<{ nome: string }>).map((m) => m.nome)
    expect(names).toEqual(['Mike', 'Zulu', 'Alpha', 'Beta', 'Gama'])
  })

  it('labels never-updated items with null days and the stagnation flag', async () => {
    const find = vi
      .fn()
      .mockResolvedValue(
        findResult([municipalityDoc({ id: 1, lastUpdateAt: null, name: 'Nunca' })]),
      )

    const result = await run(find, {})
    const item = (result.municipios as Array<Record<string, unknown>>)[0]!
    expect(item.diasSemAtualizacao).toBeNull()
    expect(item.nuncaAtualizado).toBe(true)
    expect(item.ultimaAtualizacao).toBeNull()
    expect(item.tipo).toBe('Município inteiro')
  })
})

describe('getMunicipalitiesWithoutUpdate scope resolution (B189)', () => {
  it('resolves a region scope without accents into the region where', async () => {
    const find = vi
      .fn()
      .mockResolvedValue(findResult([municipalityDoc({ id: 1, region: 'Vale do Jiquiriçá' })]))
    const result = await run(find, { scope: 'Vale do Jiquiriça' })
    expect(result.escopo).toEqual({ tipo: 'regiao', nome: 'Vale do Jiquiriçá' })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { region: { equals: 'Vale do Jiquiriçá' } },
      }),
    )
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [1] } } }))
  })

  it('resolves "Salvador" into the 19 zones as one city scope', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([municipalityDoc({ id: 1 }), municipalityDoc({ id: 2, name: 'Salvador ZE 2' })]),
    )
    find.mockResolvedValueOnce(findResult([]))
    const result = await run(find, { scope: 'Salvador' })
    expect(result.escopo).toEqual({ tipo: 'cidade', nome: 'Salvador (cidade)' })
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { city: { equals: 'Salvador' } } }),
    )
  })

  it('resolves a municipality by name', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([municipalityDoc({ id: 1 })]))
    find.mockResolvedValueOnce(findResult([]))
    const result = await run(find, { scope: 'amargosa' })
    expect(result.escopo).toEqual({ tipo: 'municipio', nome: 'Amargosa' })
  })

  it('rejects an unknown scope with the family error message', async () => {
    const find = vi.fn()
    const result = await run(find, { scope: 'Atlântida' })
    expect(result).toMatchObject({ error: expect.stringContaining('Escopo não reconhecido') })
    expect(find).not.toHaveBeenCalled()
  })

  it('filters the scope query by municipality ids when a scope resolved them', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(findResult([municipalityDoc({ id: 1 }), municipalityDoc({ id: 2 })]))
    find.mockResolvedValueOnce(findResult([]))
    await run(find, { scope: 'Salvador' }, advisor)
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: { in: [1, 2] } },
        overrideAccess: false,
        user: advisor,
      }),
    )
  })
})

describe('getMunicipalitiesWithoutUpdate advisors (B189)', () => {
  it('resolves advisor names via a second campaignUser query and attaches them to items', async () => {
    const find = vi.fn()
    find.mockResolvedValueOnce(
      findResult([municipalityDoc({ id: 1, advisors: [41, 42] }), municipalityDoc({ id: 2 })]),
    )
    find.mockResolvedValueOnce(findResult([{ id: 41, name: 'Ana Assessora' }]))

    const result = await run(find, {})
    const items = result.municipios as Array<{
      assessores: Array<{ id: number; nome: string | null }>
    }>
    expect(items[0]!.assessores).toEqual([
      { id: 41, nome: 'Ana Assessora' },
      { id: 42, nome: null },
    ])
    expect(items[1]!.assessores).toEqual([])
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'campaignUser',
        where: { id: { in: [41, 42] } },
        select: { name: true },
        overrideAccess: false,
      }),
    )
  })

  it('keeps zone items typed as electoral zones', async () => {
    const find = vi.fn().mockResolvedValue(
      findResult([
        municipalityDoc({
          id: 1,
          kind: 'zona',
          name: 'Salvador ZE 3',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
        }),
      ]),
    )
    const result = await run(find, {})
    const item = (result.municipios as Array<Record<string, unknown>>)[0]!
    expect(item.tipo).toBe('Zona eleitoral (Salvador)')
    expect(item.cidade).toBe('Salvador')
  })
})
