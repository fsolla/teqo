// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { updateStateDeputyBallotNameRecord } from '@/app/(campaign)/campanha/actions/stateDeputy'
import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('updateStateDeputyBallotNameRecord (C129)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('lets staff set the ballot name on a dobradinha', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy()

    const updated = await updateStateDeputyBallotNameRecord(payload, coordinator, {
      id: stateDeputy.id,
      ballotName: 'Ana do Povo',
    })

    expect(updated.ballotName).toBe('Ana do Povo')

    const reloaded = await payload.findByID({
      collection: 'stateDeputy',
      id: stateDeputy.id,
      depth: 0,
      select: { ballotName: true },
      overrideAccess: true,
    })
    expect(reloaded.ballotName).toBe('Ana do Povo')
  })

  it('clears the ballot name when sent null (empty cell)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const stateDeputy = await fixtures.createStateDeputy({ ballotName: 'Nome da Urna' })

    const updated = await updateStateDeputyBallotNameRecord(payload, coordinator, {
      id: stateDeputy.id,
      ballotName: null,
    })

    expect(updated.ballotName).toBeNull()

    const reloaded = await payload.findByID({
      collection: 'stateDeputy',
      id: stateDeputy.id,
      depth: 0,
      select: { ballotName: true },
      overrideAccess: true,
    })
    expect(reloaded.ballotName).toBeNull()
  })

  it('lets an advisor edit the ballot name of a dobradinha (staff scope, no carteira gate)', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const stateDeputy = await fixtures.createStateDeputy()

    const updated = await updateStateDeputyBallotNameRecord(payload, advisor, {
      id: stateDeputy.id,
      ballotName: 'Apelido da Mesa',
    })

    expect(updated.ballotName).toBe('Apelido da Mesa')

    const reloaded = await payload.findByID({
      collection: 'stateDeputy',
      id: stateDeputy.id,
      depth: 0,
      select: { ballotName: true },
      overrideAccess: true,
    })
    expect(reloaded.ballotName).toBe('Apelido da Mesa')
  })

  it('refuses a leader (staff gate)', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')
    const stateDeputy = await fixtures.createStateDeputy()

    await expect(
      updateStateDeputyBallotNameRecord(payload, leader, {
        id: stateDeputy.id,
        ballotName: 'Forçado',
      }),
    ).rejects.toThrow()
  })

  it('creates a dobradinha with the ballot name through the fixture shape', async () => {
    const fixtures = campaignFixtures()
    const stateDeputy = await fixtures.createStateDeputy({ ballotName: 'Nome desde a criação' })

    expect(stateDeputy.ballotName).toBe('Nome desde a criação')
  })
})
