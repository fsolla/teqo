// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createActivityRecord } from '@/app/(campaign)/campanha/actions/activity'
import {
  createCalendarFeedLinkRecord,
  listCalendarFeedsRecord,
  revokeCalendarFeedRecord,
  type CalendarFeedLinkResult,
} from '@/app/(campaign)/campanha/actions/calendarFeed'
import config from '@/payload.config'
import { loadFeedActivities, resolveFeedCreatorAccess } from '@/utilities/calendarFeed'
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

const validActivityInput = (municipalityId: number, title: string) => ({
  title,
  tags: ['Caminhada'],
  status: 'confirmado' as const,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  municipality: municipalityId,
  locality: 'Centro',
})

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

  it('lets a pinned feed of an in-scope advisor serve that municipality activities (C96)', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(municipality, [advisor.id])

    const activity = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(relationId(municipality), campaignFixtures().value('Caminhada assessor')),
    )
    campaignFixtures().own('activity', activity.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, advisor, {
        label: 'Carteira',
        filterMunicipality: relationId(municipality),
      }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    const access = await resolveFeedCreatorAccess(payload, feed)
    expect(access.accessible).toBe(true)
    expect(access.municipalityIds).toContain(relationId(municipality))

    const activities = await loadFeedActivities(payload, feed, access.municipalityIds)
    expect(activities.map((doc) => doc.id)).toContain(activity.id)
  })

  it('stops serving a pinned municipality once the advisor is removed (C96)', async () => {
    const advisor = await campaignFixtures().createCampaignUser('advisor')
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()
    await campaignFixtures().assignMunicipalityAdvisors(municipality, [advisor.id])

    const activity = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(relationId(municipality), campaignFixtures().value('Caminhada removida')),
    )
    campaignFixtures().own('activity', activity.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, advisor, {
        label: 'Carteira',
        filterMunicipality: relationId(municipality),
      }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)

    // The advisor loses the municipality after creating the feed. The read must
    // re-derive scope on every request (fail-closed), not trust write time.
    await campaignFixtures().assignMunicipalityAdvisors(municipality.id, [])

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    const access = await resolveFeedCreatorAccess(payload, feed)
    expect(access.accessible).toBe(true)
    expect(access.municipalityIds).toEqual([])

    const activities = await loadFeedActivities(payload, feed, access.municipalityIds)
    expect(activities.map((doc) => doc.id)).not.toContain(activity.id)
    expect(activities).toHaveLength(0)
  })

  it('keeps a coordinator pinned feed serving the municipality (unrestricted, C96)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()

    const activity = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(relationId(municipality), campaignFixtures().value('Caminhada coord')),
    )
    campaignFixtures().own('activity', activity.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, {
        label: 'Coord geral',
        filterMunicipality: relationId(municipality),
      }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    const access = await resolveFeedCreatorAccess(payload, feed)
    expect(access.accessible).toBe(true)
    expect(access.municipalityIds).toBeNull()

    const activities = await loadFeedActivities(payload, feed, access.municipalityIds)
    expect(activities.map((doc) => doc.id)).toContain(activity.id)
  })

  it('covers every municipality of the coordinator scope in a filterless feed (C93)', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipalityA = await fixtures.getMunicipality()
    const municipalityB = await fixtures.getMunicipality()

    const activityInA = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipalityA.id, fixtures.value('Atividade A')),
    )
    fixtures.own('activity', activityInA.id)
    const activityInB = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipalityB.id, fixtures.value('Atividade B')),
    )
    fixtures.own('activity', activityInB.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Agenda completa' }),
    )
    fixtures.own('calendarFeed', ok.feedId)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })
    expect(feed.filterMunicipality).toBeFalsy()

    const access = await resolveFeedCreatorAccess(payload, feed)
    expect(access.accessible).toBe(true)
    expect(access.municipalityIds).toBeNull()

    const activities = await loadFeedActivities(payload, feed, access.municipalityIds)
    const ids = activities.map((activity) => activity.id)
    expect(ids).toContain(activityInA.id)
    expect(ids).toContain(activityInB.id)
  })

  it('scopes a filterless feed to every municipality the advisor administers (C93)', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipalityA = await fixtures.getMunicipality()
    const municipalityB = await fixtures.getMunicipality()
    const municipalityC = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipalityA, [advisor.id])
    await fixtures.assignMunicipalityAdvisors(municipalityB, [advisor.id])

    const activityInScopeA = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipalityA.id, fixtures.value('Atividade administrada A')),
    )
    fixtures.own('activity', activityInScopeA.id)
    const activityInScopeB = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipalityB.id, fixtures.value('Atividade administrada B')),
    )
    fixtures.own('activity', activityInScopeB.id)
    const activityOutOfScope = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(municipalityC.id, fixtures.value('Atividade fora do escopo')),
    )
    fixtures.own('activity', activityOutOfScope.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, advisor, { label: 'Meu portfólio' }),
    )
    fixtures.own('calendarFeed', ok.feedId)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })

    const access = await resolveFeedCreatorAccess(payload, feed)
    expect(access.accessible).toBe(true)
    const advisorMunicipalities = access.municipalityIds as number[]
    expect(advisorMunicipalities).toHaveLength(2)
    expect(advisorMunicipalities).toEqual(
      expect.arrayContaining([municipalityA.id, municipalityB.id]),
    )

    const activities = await loadFeedActivities(payload, feed, advisorMunicipalities)
    const ids = activities.map((activity) => activity.id)
    expect(ids).toContain(activityInScopeA.id)
    expect(ids).toContain(activityInScopeB.id)
    expect(ids).not.toContain(activityOutOfScope.id)
  })

  it('serves an empty filterless feed when the advisor administers no municipality (C93)', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const unadministered = await fixtures.getMunicipality()

    const activity = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(unadministered.id, fixtures.value('Nunca servida')),
    )
    fixtures.own('activity', activity.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, advisor, { label: 'Sem municípios' }),
    )
    fixtures.own('calendarFeed', ok.feedId)

    const feed = await payload.findByID({
      collection: 'calendarFeed',
      id: ok.feedId,
      depth: 0,
      overrideAccess: true,
    })

    const access = await resolveFeedCreatorAccess(payload, feed)
    expect(access.accessible).toBe(true)
    expect(access.municipalityIds).toEqual([])

    const activities = await loadFeedActivities(payload, feed, access.municipalityIds)
    expect(activities).toHaveLength(0)
  })

  it('serves a live feed over two GETs with fresh validators (C113)', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const municipality = await campaignFixtures().getMunicipality()

    const route = await import('@/app/(campaign)/campanha/agenda/ical/[secret]/route')
    expect(route.dynamic).toBe('force-dynamic')

    const titleA = campaignFixtures().value('Comício vivo')
    const titleB = campaignFixtures().value('Caminhada viva')
    const activityA = await createActivityRecord(
      payload,
      coordinator,
      validActivityInput(relationId(municipality), titleA),
    )
    campaignFixtures().own('activity', activityA.id)

    const ok = requireOk(
      await createCalendarFeedLinkRecord(payload, coordinator, { label: 'Feed vivo' }),
    )
    campaignFixtures().own('calendarFeed', ok.feedId)
    const secret = ok.feedUrl.match(/\/campanha\/agenda\/ical\/([0-9a-f-]{36})$/)![1]

    const feedUrl = `http://localhost/campanha/agenda/ical/${secret}`
    const getFeed = (headers: Record<string, string> = {}) =>
      route.GET(new Request(feedUrl, { headers }), { params: Promise.resolve({ secret }) })

    const first = await getFeed()
    expect(first.status).toBe(200)
    expect(first.headers.get('Cache-Control')).toBe('public, no-cache')
    expect(first.headers.get('ETag')).toMatch(/^"[0-9a-f]{64}"$/)
    expect(first.headers.get('Last-Modified')).toMatch(/ GMT$/)
    const firstBody = await first.text()
    expect(firstBody).toContain(titleA)
    expect(firstBody).not.toContain(titleB)
    expect(firstBody).toContain('X-PUBLISHED-TTL:PT1H')
    const firstEtag = first.headers.get('ETag')!

    const activityB = await createActivityRecord(payload, coordinator, {
      ...validActivityInput(relationId(municipality), titleB),
      // An hour after activity A, so the DTSTART proof is unique to B.
      startAt: new Date(Date.now() + 86_400_000 + 3_600_000).toISOString(),
    })
    campaignFixtures().own('activity', activityB.id)

    // A commitment created after the first fetch shows up on the second GET,
    // with a changed validator — the C113 acceptance.
    const second = await getFeed()
    expect(second.status).toBe(200)
    const secondBody = await second.text()
    expect(secondBody).toContain(titleA)
    expect(secondBody).toContain(titleB)
    expect(second.headers.get('ETag')).not.toBe(firstEtag)

    // Schedule edits reflect on the next GET (the title is immutable by
    // design — the canonical slug — so the proof is the DTSTART change).
    const icalDateTimeOf = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const originalStart = activityB.startAt!
    const editedStart = new Date(Date.now() + 86_400_000 + 7_200_000).toISOString()
    await payload.update({
      collection: 'activity',
      id: activityB.id,
      data: { startAt: editedStart },
      depth: 0,
      user: coordinator,
      overrideAccess: false,
    })
    const edited = await getFeed()
    const editedBody = await edited.text()
    expect(editedBody).toContain(`DTSTART:${icalDateTimeOf(editedStart)}`)
    expect(editedBody).not.toContain(`DTSTART:${icalDateTimeOf(originalStart)}`)

    // A subscriber holding the FIRST validator gets a full fresh 200, never a
    // stale 304 — the freeze story of C113.
    const staleRevalidation = await getFeed({ 'if-none-match': firstEtag })
    expect(staleRevalidation.status).toBe(200)
    expect(await staleRevalidation.text()).toContain(`DTSTART:${icalDateTimeOf(editedStart)}`)

    // Cancellation removes the event without leaving a ghost.
    await payload.update({
      collection: 'activity',
      id: activityB.id,
      data: { status: 'cancelado' },
      depth: 0,
      user: coordinator,
      overrideAccess: false,
    })
    const cancelled = await getFeed()
    const cancelledBody = await cancelled.text()
    expect(cancelledBody).not.toContain(titleB)
    expect(cancelledBody).toContain(titleA)

    // A conditional GET with the current validator revalidates cheaply.
    const revalidated = await getFeed({ 'if-none-match': cancelled.headers.get('ETag')! })
    expect(revalidated.status).toBe(304)
    expect(await revalidated.text()).toBe('')
  })
})
