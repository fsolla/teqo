// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  createCalendarFeedLinkRecord,
  listCalendarFeedsRecord,
  revokeCalendarFeedRecord,
  type CalendarFeedLinkResult,
} from '@/app/(campaign)/campanha/actions/calendarFeed'
import config from '@/payload.config'
import { hookFilledCreateData } from '@/utilities/hookFilledData'

import { installCampaignFixtures, relationId } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

type CalendarFeedWithSecret = { secretSlug?: string }

/** `{ ok: true }` branch of the create result, narrowed for the caller. */
type CalendarFeedOk = Extract<CalendarFeedLinkResult, { ok: true }>

const requireOk = (result: CalendarFeedLinkResult): CalendarFeedOk => {
  if (!result.ok) throw new Error(result.message)
  return result
}

describe('campaign calendar feed domain', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('lets a coordinator create a feed and resolves the secret into a URL', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, {
        label: 'Agenda do comitê',
        filterMunicipality: relationId(municipality),
        filterDeputyPresent: true,
      }),
    )
    expect(ok.feedUrl).toMatch(/\/campanha\/agenda\/ical\/.{36}$/)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    expect(feed.label).toBe('Agenda do comitê')
    expect(relationId(feed.createdBy)).toBe(coordinator.id)
    expect(feed.filterDeputyPresent).toBe(true)
    expect(relationId(feed.filterMunicipality)).toBe(relationId(municipality))
    campaignFixtures().own('calendarFeed', ok.feedId)
  })

  it('allows a candidate to create a feed', async () => {
    const candidate = await campaignFixtures().createCampaignUser('candidate')

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, candidate, {
        label: 'Agenda do candidato',
      }),
    )
    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    expect(relationId(feed.createdBy)).toBe(candidate.id)
    campaignFixtures().own('calendarFeed', ok.feedId)
  })

  it('stamps createdBy from the acting staff user, overriding a forged value', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const other = await campaignFixtures().createCampaignUser('coordinator')

    // The hook must win over a client-supplied `createdBy`, even a bare create
    // that does not go through the action (a REST `/api/calendarFeeds` hit).
    const feed = await payload.create({
      collection: 'calendarFeed',
      data: {
        secretSlug: crypto.randomUUID(),
        label: 'Forjado',
        createdBy: other.id,
      },
      depth: 0,
      draft: false,
      user: coordinator,
      overrideAccess: false,
    })
    expect(relationId(feed.createdBy)).toBe(coordinator.id)
    campaignFixtures().own('calendarFeed', feed.id)
  })

  it('lets the owning coordinator mark the feed revoked (field access fix)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Revogável' }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)

    const revoked = await revokeCalendarFeedRecord(payload, coordinator, ok.feedId)
    expect(revoked.ok).toBe(true)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    expect(feed.revokedAt).toBeTruthy()
  })

  it('hides revoked feeds from an active listing', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const kept = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Ativo' }),
    )
    campaignFixtures().own('calendarFeed', kept.feedId)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Revogar logo' }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)
    await revokeCalendarFeedRecord(payload, coordinator, ok.feedId)

    const listing = await listCalendarFeedsRecord(payload, coordinator)
    const ids = listing.map((feed) => feed.id)
    expect(ids).toContain(kept.feedId)
    expect(ids).not.toContain(ok.feedId)
  })

  it('lets an advisor create a feed pinned to a municipality they administer', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const administered = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(administered, [advisor.id])

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, advisor, {
        label: 'Meu município',
        filterMunicipality: relationId(administered),
      }),
    )
    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    expect(relationId(feed.createdBy)).toBe(advisor.id)
    expect(relationId(feed.filterMunicipality)).toBe(relationId(administered))
    campaignFixtures().own('calendarFeed', ok.feedId)
  })

  it('fails close when an advisor pins a municipality outside their scope (action path)', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const administered = await campaignFixtures().getMunicipality()
    const outOfScope = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(administered, [advisor.id])

    await expect(
      createCalendarFeedLinkRecord(payload, advisor, {
        label: 'Fora do escopo',
        filterMunicipality: relationId(outOfScope),
      }),
    ).rejects.toThrow(/fora do seu escopo/)
  })

  it('fails close when an advisor pins an out-of-scope municipality via raw create (collection access)', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const administered = await campaignFixtures().getMunicipality()
    const outOfScope = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(administered, [advisor.id])

    await expect(
      payload.create({
        collection: 'calendarFeed',
        // `createdBy` is filled by the stamp hook at runtime; `hookFilledCreateData`
        // keeps the type honest about what the client actually supplies.
        data: hookFilledCreateData<'calendarFeed'>({
          secretSlug: crypto.randomUUID(),
          label: 'Fora do escopo (REST)',
          filterMunicipality: relationId(outOfScope),
        }),
        depth: 0,
        draft: false,
        user: advisor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/não tem permissão/i)
  })

  it('blocks a leader from creating a feed', async () => {
    const leader = await campaignFixtures().createCampaignUser('leader')

    await expect(
      createCalendarFeedLinkRecord(payload, leader, {
        label: 'Não permitido',
      }),
    ).rejects.toThrow(/apenas a equipe da campanha/i)
  })

  it('refuses an advisor revoking a feed they do not own', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Do coordenador' }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)

    await expect(revokeCalendarFeedRecord(payload, advisor, ok.feedId)).rejects.toThrow()
  })

  it('never exposes the secret slug to a staff read', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Segredo' }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      user: coordinator,
      overrideAccess: false,
    })
    expect((feed as unknown as CalendarFeedWithSecret).secretSlug).toBeUndefined()
  })
})
