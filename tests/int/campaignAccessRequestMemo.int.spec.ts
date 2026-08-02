// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

/** Counts pool statements matching `fragment` (or `match`) while `run` executes. */
const countStatements = async <T>(
  fragment: string,
  run: () => Promise<T>,
  match?: (text: string, params: unknown) => boolean,
): Promise<{ result: T; count: number }> => {
  const pool = (payload.db as unknown as { pool: { query: (...args: unknown[]) => unknown } }).pool
  const originalQuery = pool.query.bind(pool)
  let count = 0

  pool.query = (...args: unknown[]) => {
    const first = args[0]
    const text =
      typeof first === 'string'
        ? first
        : typeof (first as { text?: unknown })?.text === 'string'
          ? ((first as { text: string }).text as string)
          : ''
    const params =
      typeof first === 'string'
        ? args[1]
        : ((first as { values?: unknown })?.values ?? args[1])
    const hits = match ? match(text, params) : text.includes(fragment)
    if (hits) count += 1
    return originalQuery(...args)
  }

  try {
    return { result: await run(), count }
  } finally {
    pool.query = originalQuery
  }
}

/**
 * The RBAC modules memoize their repeated reads per request via
 * `memoizePerRequest` (`utilities/access/shared.ts`), keyed on the `req` OBJECT
 * rather than on `req.context`.
 *
 * The `req.context` version it replaced was dead on the populate path:
 * `createLocalReq` reassigns `req.context` to a fresh copy on every nested Local
 * API call, so a `depth: 1` read of 25 leaderships produced 367 calls into
 * `getFreshCampaignUser` across **367 distinct context objects and one `req`** —
 * 367 identical `campaign_user` selects, 185 ms of the route's 229 ms (P1 in
 * `docs/TECH-DEBT.md`). Field-level access is what multiplies: it runs per
 * document per field inside `traverseFields`, and every check asks the same
 * question ("is this actor staff?").
 */
describe('access-control per-request memo', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('reads the actor once for a whole scoped list read, not once per populated field', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const leadershipIds: number[] = []

    for (let index = 0; index < 3; index += 1) {
      const contact = await fixtures.createContact()
      const leadership = await fixtures.createLeadership({
        contact: contact.id,
        municipalities: [municipality.id],
        supportStatus: 'engajado',
      })
      leadershipIds.push(leadership.id)
    }

    // Count only SELECT … WHERE id = <actor>. Other `campaign_user` rows can
    // appear at depth 1 when leftover docs in the same municipality have
    // `user` set — that is populate, not a broken memo.
    const { result, count } = await countStatements(
      `from "campaign_user"`,
      () =>
        payload.find({
          collection: 'leadership',
          // depth 1 is what the list loaders use; it is also what multiplies the
          // field-level access checks across every populated relation.
          depth: 1,
          limit: 25,
          user: coordinator,
          overrideAccess: false,
          where: { id: { in: leadershipIds } },
        }),
      (text, params) =>
        text.includes('from "campaign_user"') &&
        Array.isArray(params) &&
        params.includes(coordinator.id),
    )

    expect(result.docs).toHaveLength(3)
    // One read for the whole operation. Before the fix this was in the hundreds
    // and grew with rows × populated fields.
    expect(count).toBe(1)
  })

  it('honors a role change on the next operation — the memo dies with the request', async () => {
    const fixtures = campaignFixtures()
    const staff = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })

    // `staff` still carries the stale coordinator role in memory, exactly like a
    // JWT would: the fresh read is what must catch the downgrade.
    const asCoordinator = await payload.find({
      collection: 'leadership',
      depth: 0,
      limit: 25,
      user: staff,
      overrideAccess: false,
    })
    expect(asCoordinator.docs.length).toBeGreaterThan(0)

    await payload.update({
      collection: 'campaignUser',
      id: staff.id,
      data: { role: 'leader' },
      depth: 0,
      overrideAccess: true,
    })

    // `leader` is lockdown on `leadership`: the collection refuses outright.
    await expect(
      payload.find({
        collection: 'leadership',
        depth: 0,
        limit: 25,
        user: staff,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão/i)
  })

  it('does not leak one actor’s scope into another’s within the same process', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.getMunicipality()
    const contact = await fixtures.createContact()
    await fixtures.createLeadership({
      contact: contact.id,
      municipalities: [municipality.id],
      supportStatus: 'engajado',
    })

    // The advisor administers nothing, so their scope is empty; the coordinator
    // sees everything. The memo is keyed by actor id, so running them back to
    // back must not hand the second the first one's answer.
    const asAdvisor = await payload.find({
      collection: 'leadership',
      depth: 0,
      limit: 25,
      user: advisor,
      overrideAccess: false,
    })
    expect(asAdvisor.docs).toEqual([])

    const asCoordinator = await payload.find({
      collection: 'leadership',
      depth: 0,
      limit: 25,
      user: coordinator,
      overrideAccess: false,
    })

    expect(asCoordinator.docs.length).toBeGreaterThan(0)
  })
})
