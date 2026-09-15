// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// `loadMunicipalityElectoralBaseline` is wrapped in Next's `unstable_cache`
// (needs the Next server runtime). The snapshot only forwards its result, so
// stub the module exactly like `municipalityDossierData.int.spec.ts` does.
vi.mock('@/utilities/municipality/municipalityElectoralBaseline', () => ({
  loadMunicipalityElectoralBaseline: vi.fn().mockResolvedValue(null),
}))

import config from '@/payload.config'

import { composeCityReportSnapshot } from '../../scripts/cityReportSnapshot.mjs'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('city report snapshot (C163)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('composes a read-only snapshot without contact PII', { timeout: 30_000 }, async () => {
    const fixtures = campaignFixtures()
    const candidate = await fixtures.createCampaignUser('candidate')
    const advisor = await fixtures.createCampaignUser('advisor')
    const municipality = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(municipality, [advisor])

    const contact = await fixtures.createContact()
    const leadership = await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
    })
    await fixtures.createMunicipalityUpdate({
      municipality: municipality.id,
      author: candidate.id,
      polarity: 'boa',
      body: 'Sinal de teste do snapshot',
    })

    const actor = { ...candidate, collection: 'campaignUser' as const }
    const snapshot = await composeCityReportSnapshot({
      payload,
      actor,
      slug: municipality.slug,
      codeSha: 'test-sha',
      database: 'localhost:5432/teqo_wt_test',
    })

    expect(snapshot.meta).toEqual(
      expect.objectContaining({
        readOnly: true,
        codeSha: 'test-sha',
        actorRole: 'candidate',
      }),
    )
    expect(snapshot.municipality.slug).toBe(municipality.slug)
    expect(snapshot.advisors.map((advisorRow: { name: string }) => advisorRow.name)).toContain(
      advisor.name,
    )
    expect(snapshot.leaderships.totalCount).toBeGreaterThan(0)
    const row = snapshot.leaderships.rows.find(
      (leadershipRow) => leadershipRow.id === leadership.id,
    )!
    expect(row.name).toBe(contact.name)
    expect('phone' in row).toBe(false)
    expect('email' in row).toBe(false)
    expect('contactID' in row).toBe(false)
    expect(snapshot.signals.totalCount).toBeGreaterThan(0)
    expect(JSON.stringify(snapshot)).not.toContain(contact.phone)
  })
})
