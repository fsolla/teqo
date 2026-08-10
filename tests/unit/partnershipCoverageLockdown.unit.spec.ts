import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import type { AIToolContext } from '@/lib/ai/types'
import type { CampaignUser } from '@/payload-types'
import { getPartnershipCoverage } from '@/utilities/ai/tools/getPartnershipCoverage'

import { stub } from '../helpers/stub'

const denied = { error: 'Leitura de dados da campanha negada.' }

/** A payload whose find throws — any query after a failed gate is a bug. */
const untouchablePayload = stub<Payload>({
  find: () => {
    throw new Error('gate must fail closed before any payload query')
  },
})

const ctxFor = (user: CampaignUser, payload: Payload): AIToolContext => ({ user, payload })

const leader = stub<CampaignUser>({ collection: 'campaignUser', role: 'leader' })
const coordinator = stub<CampaignUser>({ collection: 'campaignUser', role: 'coordinator' })

type ExecutableTool = {
  execute: (args: unknown, options?: unknown) => Promise<unknown>
}

const executeFor = (user: CampaignUser, payload: Payload) => {
  const execute = (getPartnershipCoverage(ctxFor(user, payload)) as unknown as ExecutableTool)
    .execute
  return (args: unknown) => execute(args)
}

const emptyDocsPayload = stub<Payload>({
  find: async () => ({
    docs: [],
    hasNextPage: false,
    hasPrevPage: false,
    limit: 0,
    nextPage: null,
    pagingCounter: 0,
    prevPage: null,
    totalDocs: 0,
    totalPages: 0,
  }),
})

/**
 * Stub payload dispatching by collection: municipality rows (coverage read),
 * municipality rows carrying only `stateDeputies` (orphan aggregate), and
 * stateDeputy/contact docs for the orphan mode. The generic `Payload['find']`
 * cannot express arbitrary populated docs, so the mock is cast at the call
 * site — the same tradeoff `stub` already makes for completeness.
 */
const coveragePayload = (overrides: {
  municipalities?: Array<Record<string, unknown>>
  municipalityStateDeputies?: number[]
  stateDeputies?: Array<Record<string, unknown>>
  contacts?: Array<Record<string, unknown>>
}): Payload => {
  const find = (async ({ collection }: { collection?: string }) => {
    const docs =
      collection === 'municipality' && overrides.municipalityStateDeputies
        ? overrides.municipalityStateDeputies.map((id) => ({ id, stateDeputies: [id] }))
        : collection === 'municipality'
          ? (overrides.municipalities ?? [])
          : collection === 'stateDeputy'
            ? (overrides.stateDeputies ?? [])
            : (overrides.contacts ?? [])
    return {
      docs,
      hasNextPage: false,
      hasPrevPage: false,
      limit: 0,
      nextPage: null,
      pagingCounter: 0,
      prevPage: null,
      totalDocs: 0,
      totalPages: 0,
    }
  }) as unknown as Payload['find']

  return stub<Payload>({ find })
}

describe('partnership coverage tools leader lockdown (B190)', () => {
  it('getPartnershipCoverage (municipalities) fails closed before any payload query', async () => {
    await expect(
      executeFor(leader, untouchablePayload)({ mode: 'municipalities' }),
    ).resolves.toEqual(denied)
  })

  it('getPartnershipCoverage (orphanDeputies) fails closed before any payload query', async () => {
    await expect(
      executeFor(leader, untouchablePayload)({ mode: 'orphanDeputies' }),
    ).resolves.toEqual(denied)
  })

  it('lets staff pass the gate (queries reach payload)', async () => {
    const result = await executeFor(coordinator, emptyDocsPayload)({ mode: 'municipalities' })
    expect(result).toMatchObject({ message: 'Nenhum município sem dobradinha no escopo atual.' })
  })
})

describe('partnership coverage tool staff behavior (B190)', () => {
  it('returns empty municipalities with the declared criterion', async () => {
    const result = await executeFor(coordinator, emptyDocsPayload)({ mode: 'municipalities' })
    expect(result).toMatchObject({
      message: 'Nenhum município sem dobradinha no escopo atual.',
      criterio: expect.stringContaining('cadastro atual'),
    })
  })

  it('groups Salvador zones under the city by default', async () => {
    const payload = coveragePayload({
      municipalities: [
        {
          name: 'Salvador — ZE 1',
          slug: 'salvador-ze-1',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
          zoneNumber: 1,
        },
        {
          name: 'Salvador — ZE 3',
          slug: 'salvador-ze-3',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
          zoneNumber: 3,
        },
        { name: 'Ilhéus', slug: 'ilheus', city: 'Ilhéus', region: 'Litoral Sul', zoneNumber: null },
      ],
    })

    const result = await executeFor(coordinator, payload)({ mode: 'municipalities' })
    expect(result).toMatchObject({
      agrupadoPorCidade: true,
      total: 3,
      municipios: [
        { nome: 'Ilhéus', slug: 'ilheus', unidades: 1 },
        { nome: 'Salvador', slug: 'salvador', unidades: 2 },
      ],
    })
  })

  it('expands Salvador zones when expandZones is true', async () => {
    const payload = coveragePayload({
      municipalities: [
        {
          name: 'Salvador — ZE 1',
          slug: 'salvador-ze-1',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
          zoneNumber: 1,
        },
        {
          name: 'Salvador — ZE 3',
          slug: 'salvador-ze-3',
          city: 'Salvador',
          region: 'Metropolitano de Salvador',
          zoneNumber: 3,
        },
      ],
    })

    const result = await executeFor(
      coordinator,
      payload,
    )({
      mode: 'municipalities',
      expandZones: true,
    })
    expect(result).toMatchObject({
      agrupadoPorCidade: false,
      total: 2,
      municipios: [
        { nome: 'Salvador — ZE 1', slug: 'salvador-ze-1' },
        { nome: 'Salvador — ZE 3', slug: 'salvador-ze-3' },
      ],
    })
  })

  it('rejects an unrecognized region with a helpful error', async () => {
    const result = await executeFor(
      coordinator,
      emptyDocsPayload,
    )({
      mode: 'municipalities',
      region: 'Planeta Marte',
    })
    expect(result).toMatchObject({ error: expect.stringContaining('Região não reconhecida') })
  })

  it('returns orphans only for deputies with no municipality anywhere', async () => {
    const payload = coveragePayload({
      // Municipality 1 links deputy 10; municipality 2 links deputies 10 and 20.
      municipalityStateDeputies: [10, 20],
      stateDeputies: [
        { id: 10, slug: 'maria', party: 'PT', notes: null, contact: 100 },
        { id: 20, slug: 'joao', party: 'PSB', notes: null, contact: 200 },
        { id: 30, slug: 'ana', party: 'PCdoB', notes: null, contact: 300 },
      ],
      contacts: [
        { id: 100, name: 'Maria' },
        { id: 200, name: 'João' },
        { id: 300, name: 'Ana' },
      ],
    })

    const result = await executeFor(coordinator, payload)({ mode: 'orphanDeputies' })
    expect(result).toMatchObject({
      criterio: expect.stringContaining('cadastro atual'),
      total: 1,
      dobradinhas: [{ nome: 'Ana', slug: 'ana', partido: 'PCdoB' }],
    })
  })

  it('reports when no orphan dobradinhas exist', async () => {
    const payload = coveragePayload({
      municipalityStateDeputies: [10],
      stateDeputies: [{ id: 10, slug: 'maria', party: 'PT', notes: null, contact: 100 }],
      contacts: [{ id: 100, name: 'Maria' }],
    })

    const result = await executeFor(coordinator, payload)({ mode: 'orphanDeputies' })
    expect(result).toMatchObject({
      message: 'Nenhuma dobradinha órfã cadastrada.',
      criterio: expect.stringContaining('cadastro atual'),
    })
  })
})
