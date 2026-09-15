import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import config from '../../src/payload.config'

/**
 * Payload semantics pin for the fixture-ownership hazard that broke the B32/B34
 * verify runs (2026-09-15): an empty `or: []` is NOT "match nothing" — the
 * Drizzle query builder drops it, the find runs with no WHERE and returns
 * EVERY row. The e2e fixture's `discoverOwnedRows` used a dynamic `or` for the
 * leadership discovery; a test that created no campaignUser and no contact
 * (read-only journey) therefore owned every leadership in the shared database
 * and its cleanup deleted rows other workers were using (B32's cell vanished
 * mid-test, B34's row was gone on load). The fixture now guards the empty case
 * (`leadershipConditions.length > 0`) like the int fixture.
 *
 * This spec pins the behavior that makes the guard mandatory: if a Payload
 * upgrade ever makes `or: []` match nothing, revisit the guard — but keep the
 * guard, because "no where" also happens by accident.
 */
describe('campaign fixture ownership hygiene', () => {
  it('where { or: [] } matches every row — never build an empty or in fixtures', async () => {
    const payload = await getPayload({ config })
    const municipality = await payload.find({
      collection: 'municipality',
      limit: 1,
      overrideAccess: true,
    })
    const contact = await payload.create({
      collection: 'contact',
      data: { name: 'Ownership Hygiene', phones: [{ value: '71900000888' }] },
      overrideAccess: true,
    })
    const leadership = await payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        municipalities: [municipality.docs[0]!.id],
        supportStatus: 'a_abordar',
      },
      overrideAccess: true,
    })

    try {
      const count = await payload.count({ collection: 'leadership', overrideAccess: true })
      const emptyOr = await payload.find({
        collection: 'leadership',
        where: { or: [] },
        pagination: false,
        overrideAccess: true,
      })

      expect(count.totalDocs).toBeGreaterThan(0)
      expect(emptyOr.docs.length).toBe(count.totalDocs)
    } finally {
      await payload.delete({ collection: 'leadership', id: leadership.id, overrideAccess: true })
      await payload.delete({ collection: 'contact', id: contact.id, overrideAccess: true })
    }
  })
})
