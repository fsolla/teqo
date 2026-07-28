// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign allocation decisions', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('records an immutable ex-ante decision in the advisor municipality scope', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const decision = await payload.create({
      collection: 'allocationDecision',
      data: {
        municipality: municipality.id,
        patternId: 'P3-cobertura-baixa',
        outcome: 'aceita',
        rationale: 'A cobertura dos compromissos está abaixo do esperado.',
        snapshot: { coverage: 0.42, scenario: 'central' },
      },
      depth: 0,
      user: advisor,
      overrideAccess: false,
    })
    fixtures.own('allocationDecision', decision.id)

    expect(relationId(decision.decidedBy)).toBe(advisor.id)
    await expect(
      payload.update({
        collection: 'allocationDecision',
        id: decision.id,
        data: { rationale: 'Tentativa de reescrever a decisão.' },
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('requires an alternative reading when a suggestion is discarded', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()

    await expect(
      payload.create({
        collection: 'allocationDecision',
        data: {
          municipality: municipality.id,
          patternId: 'P8-pressao-adversaria',
          outcome: 'descarta',
          rationale: 'A leitura automática não representa o contexto local.',
          snapshot: { pressureRank: 2 },
        },
        user: coordinator,
        overrideAccess: false,
      }),
    ).rejects.toThrow('leitura alternativa')
  })

  it('denies allocation decisions to leaders', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')
    const municipality = await fixtures.getMunicipality()

    await expect(
      payload.create({
        collection: 'allocationDecision',
        data: {
          municipality: municipality.id,
          patternId: 'P1-fila',
          outcome: 'aceita',
          rationale: 'Tentativa fora do papel permitido.',
          snapshot: { rank: 1 },
        },
        user: leader,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
