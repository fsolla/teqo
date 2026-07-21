// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadPlazaListPageBundle } from '@/utilities/plazaPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadPlazaListPageBundle', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns null overview and map when the filtered plaza set is empty', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')

    const bundle = await loadPlazaListPageBundle(payload, coordinator, { q: 'zzznomatch' })

    expect(bundle.plazas).toHaveLength(0)
    expect(bundle.overview).toBeNull()
    expect(bundle.mapBundle).toBeNull()
  })

  it('rolls up staffVoteTotal from expectedVotes when no pledge overrides apply', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const plaza = await fixtures.getPlaza()
    fixtures.touchPlaza(plaza.id)

    await payload.update({
      collection: 'plaza',
      id: plaza.id,
      data: { expectedVotes: 1_500 },
      depth: 0,
      overrideAccess: true,
    })

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      supportStatus: 'engajado',
    })
    await fixtures.createVotePledge({
      leadership: leadership.id,
      plaza: plaza.id,
      declaredVotes: 80,
      estimatedVotes: 120,
    })

    const bundle = await loadPlazaListPageBundle(payload, coordinator, { q: plaza.name })

    expect(bundle.overview).not.toBeNull()
    expect(bundle.mapBundle).not.toBeNull()
    expect(bundle.overview!.staffVoteTotal).toBe(1_500)
  })

  it('keeps advisor access and applies URL filters on top', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getPlaza()
    await fixtures.assignPlazaAdvisors(administered.id, [advisor.id])

    const included = await loadPlazaListPageBundle(payload, advisor, { q: administered.name })
    expect(included.mapBundle).not.toBeNull()
    expect(included.overview).not.toBeNull()
    expect(included.plazas.some((row) => row.slug === administered.slug)).toBe(true)

    const excluded =
      administered.kind === 'zona'
        ? await loadPlazaListPageBundle(payload, advisor, { kind: 'municipio' })
        : await loadPlazaListPageBundle(payload, advisor, { kind: 'zona' })
    expect(excluded.mapBundle).toBeNull()
    expect(excluded.overview).toBeNull()
    expect(excluded.plazas).toHaveLength(0)
  })

  it('omits overview and map for leaders', async () => {
    const fixtures = campaignFixtures()
    const plaza = await fixtures.getPlaza()
    const leader = await fixtures.createCampaignUser('leader')
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: leader.id,
      supportStatus: 'engajado',
    })

    const bundle = await loadPlazaListPageBundle(payload, leader, { q: plaza.name })

    expect(bundle.overview).toBeNull()
    expect(bundle.mapBundle).toBeNull()
    expect(bundle.plazas.length).toBeGreaterThan(0)
  })
})
