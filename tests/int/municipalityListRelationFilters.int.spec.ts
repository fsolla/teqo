// @vitest-environment node

/**
 * B176 — the municipality-list relation filters (Dobradinha, Liderança,
 * Partido) and their edge semantics. Pins the exact drizzle behaviour this
 * feature depends on: `in: []` matches nothing, `not_in: []` matches
 * everything, `exists: false` on a hasMany matches the absent array, and the
 * request-scoped catalog turns the reverse/cross filters into municipality
 * `where` clauses that scope against the actor.
 */
import type { Payload, Where } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { NO_PARTY_FILTER_VALUE } from '@/utilities/campaignListUrl'
import {
  buildMunicipalityListWhere,
  NO_LEADERSHIP_FILTER_VALUE,
  NO_STATE_DEPUTY_FILTER_VALUE,
  parseMunicipalityListParams,
  type MunicipalityListSearchParams,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import { loadMunicipalityListRelationCatalog } from '@/utilities/municipality/municipalityRelationSets'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

describe('municipality list relation filters (B176)', () => {
  it('pins the drizzle absence/empty-array semantics on the municipality collection', async () => {
    const fixtures = campaignFixtures()
    const [a, b, c] = await Promise.all([
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
      fixtures.getMunicipality(),
    ])
    const scope = [a.id, b.id, c.id]

    const idsFor = async (extra: Where): Promise<number[]> => {
      const result = await payload.find({
        collection: 'municipality',
        where: {
          and: [{ id: { in: scope } }, extra],
        },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      })
      return result.docs.map((doc) => doc.id).sort((left, right) => left - right)
    }

    // `in: []` matches nothing; `not_in: []` matches everything in scope.
    expect(await idsFor({ id: { in: [] } })).toEqual([])
    expect(await idsFor({ id: { not_in: [] } })).toEqual(scope)

    // `exists: false`/`in` on the hasMany `stateDeputies` array feeds the
    // whole dobradinha dimension.
    expect(await idsFor({ stateDeputies: { exists: false } })).toEqual(scope)
    expect(await idsFor({ stateDeputies: { exists: true } })).toEqual([])
  })

  it('filters by dobradinha and "Sem dobradinha" (direct relationship)', async () => {
    const fixtures = campaignFixtures()
    const a = await fixtures.getMunicipality()
    const b = await fixtures.getMunicipality()
    const c = await fixtures.getMunicipality()
    const scope = [a.id, b.id, c.id]

    const deputy = await fixtures.createStateDeputy({ name: fixtures.value('Deputado Filtro') })
    await payload.update({
      collection: 'municipality',
      id: a.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'municipality',
      id: b.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(a.id)
    fixtures.touchMunicipality(b.id)

    const state = (raw: MunicipalityListSearchParams): MunicipalityListState =>
      parseMunicipalityListParams(raw)

    const idsFor = async (extra: Where): Promise<number[]> => {
      const result = await payload.find({
        collection: 'municipality',
        where: { and: [{ id: { in: scope } }, extra] },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      })
      return result.docs.map((doc) => doc.id).sort((left, right) => left - right)
    }

    expect(
      await idsFor(buildMunicipalityListWhere(state({ stateDeputy: [String(deputy.id)] }))),
    ).toEqual([a.id, b.id])

    expect(
      await idsFor(
        buildMunicipalityListWhere(state({ stateDeputy: [NO_STATE_DEPUTY_FILTER_VALUE] })),
      ),
    ).toEqual([c.id])

    // Named OR sentinel in one query: the dobradinha OR no dobradinha.
    expect(
      await idsFor(
        buildMunicipalityListWhere(
          state({ stateDeputy: [String(deputy.id), NO_STATE_DEPUTY_FILTER_VALUE] }),
        ),
      ),
    ).toEqual([a.id, b.id, c.id])
  })

  it('filters by leadership and "Sem liderança" through the reverse catalog', async () => {
    const fixtures = campaignFixtures()
    const a = await fixtures.getMunicipality()
    const b = await fixtures.getMunicipality()
    const c = await fixtures.getMunicipality()
    const scope = [a.id, b.id, c.id]

    const leadership = await fixtures.createLeadership({
      contact: (await fixtures.createContact()).id,
      municipalities: [b.id, c.id],
    })

    const coordinator = await fixtures.createCampaignUser('coordinator')
    const catalog = await loadMunicipalityListRelationCatalog(
      payload,
      coordinator,
      parseMunicipalityListParams({ leadership: [String(leadership.id)] }),
    )

    expect(catalog.leadershipMunicipalityIDsByLeadership.get(leadership.id)).toEqual(
      expect.arrayContaining([b.id, c.id]),
    )
    expect([...catalog.allLeadershipMunicipalityIDs]).toEqual(expect.arrayContaining([b.id, c.id]))

    const state = (raw: MunicipalityListSearchParams): MunicipalityListState =>
      parseMunicipalityListParams(raw)

    const idsFor = async (extra: Where): Promise<number[]> => {
      const result = await payload.find({
        collection: 'municipality',
        where: { and: [{ id: { in: scope } }, extra] },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      })
      return result.docs.map((doc) => doc.id).sort((left, right) => left - right)
    }

    expect(
      await idsFor(
        buildMunicipalityListWhere(state({ leadership: [String(leadership.id)] }), catalog),
      ),
    ).toEqual([b.id, c.id])

    // "Sem liderança" = not linked to ANY scoped leadership → only A.
    expect(
      await idsFor(
        buildMunicipalityListWhere(state({ leadership: [NO_LEADERSHIP_FILTER_VALUE] }), catalog),
      ),
    ).toEqual([a.id])

    // Fails closed without the catalog.
    expect(() =>
      buildMunicipalityListWhere(state({ leadership: [NO_LEADERSHIP_FILTER_VALUE] })),
    ).toThrow(/missing relation catalog/)
  })

  it('filters by party and "Sem partido" through the party→deputy catalog', async () => {
    const fixtures = campaignFixtures()
    const a = await fixtures.getMunicipality()
    const b = await fixtures.getMunicipality()
    const c = await fixtures.getMunicipality()
    const scope = [a.id, b.id, c.id]

    const pt = await fixtures.createStateDeputy({
      name: fixtures.value('Deputado PT'),
      party: 'PT',
    })
    const pcredo = await fixtures.createStateDeputy({
      name: fixtures.value('Deputado PCdoB'),
      party: 'PCdoB',
    })
    // A "sem partido" deputy linked to B only.
    const noParty = await fixtures.createStateDeputy({ name: fixtures.value('Deputado Sem Sigla') })

    await payload.update({
      collection: 'municipality',
      id: a.id,
      data: { stateDeputies: [pt.id] },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'municipality',
      id: b.id,
      data: { stateDeputies: [pcredo.id, noParty.id] },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(a.id)
    fixtures.touchMunicipality(b.id)

    const coordinator = await fixtures.createCampaignUser('coordinator')
    const catalog = await loadMunicipalityListRelationCatalog(
      payload,
      coordinator,
      parseMunicipalityListParams({ party: ['PT'] }),
    )
    expect([...catalog.allPartyStateDeputyIDs]).toEqual(expect.arrayContaining([pt.id, pcredo.id]))

    const state = (raw: MunicipalityListSearchParams): MunicipalityListState =>
      parseMunicipalityListParams(raw)

    const idsFor = async (extra: Where): Promise<number[]> => {
      const result = await payload.find({
        collection: 'municipality',
        where: { and: [{ id: { in: scope } }, extra] },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
      })
      return result.docs.map((doc) => doc.id).sort((left, right) => left - right)
    }

    // PT alone → A; PCdoB + "Sem partido" (OR) → B and C (C has no dobradinha).
    expect(await idsFor(buildMunicipalityListWhere(state({ party: ['PT'] }), catalog))).toEqual([
      a.id,
    ])

    expect(
      await idsFor(
        buildMunicipalityListWhere(state({ party: ['PCdoB', NO_PARTY_FILTER_VALUE] }), catalog),
      ),
    ).toEqual([b.id, c.id])

    // A party with no deputy matches nothing.
    expect(await idsFor(buildMunicipalityListWhere(state({ party: ['PSD'] }), catalog))).toEqual([])

    expect(() => buildMunicipalityListWhere(state({ party: ['PT'] }))).toThrow(
      /missing relation catalog/,
    )
  })

  it('scopes the leadership facet catalog to the advisor portfolio', async () => {
    const fixtures = campaignFixtures()
    const inScope = await fixtures.getMunicipality()
    const outOfScope = await fixtures.getMunicipality()

    await fixtures.createLeadership({
      contact: (await fixtures.createContact()).id,
      municipalities: [inScope.id],
    })
    await fixtures.createLeadership({
      contact: (await fixtures.createContact()).id,
      municipalities: [outOfScope.id],
    })

    const advisor = await fixtures.createCampaignUser('advisor')
    await payload.update({
      collection: 'municipality',
      id: inScope.id,
      data: { advisors: [advisor.id] },
      depth: 0,
      overrideAccess: true,
    })

    const catalog = await loadMunicipalityListRelationCatalog(
      payload,
      advisor,
      parseMunicipalityListParams({ leadership: ['1'] }),
    )
    // Only the administered municipality's leaderships reach the catalog.
    expect([...catalog.allLeadershipMunicipalityIDs]).not.toContain(outOfScope.id)
    expect(catalog.allLeadershipMunicipalityIDs.has(inScope.id)).toBe(true)
  })
})
