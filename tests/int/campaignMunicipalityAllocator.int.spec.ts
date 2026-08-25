// @vitest-environment node

import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  claimMunicipalityIndex,
  releaseMunicipalityClaims,
} from '../helpers/campaignMunicipalityAllocator'

/**
 * Behavioral stress of the allocator's claims registry (OPS46). The real
 * catalog has 435 slots and a full int + e2e cycle claims ~505 of them, so
 * the sequence wraps every cycle on persistent worktree databases; these
 * tests exercise the wrap with a small synthetic `catalogSize` so the
 * properties are observable in one run. They run under the PARALLEL int
 * suite, so assertions never depend on the exact index a claim lands on —
 * only on the registry invariants (live exclusivity through the wrap,
 * exhaustion, release, stale steal) that hold regardless of what other
 * specs claim concurrently.
 */

let payload: Payload
const releasedRunIDs: string[] = []

const freshRunID = (): string => {
  const runID = randomUUID()
  releasedRunIDs.push(runID)
  return runID
}

const claimCount = async (runID: string): Promise<number> => {
  const result = await payload.db.drizzle.execute(sql`
    SELECT count(*)::int AS "count"
    FROM "campaign_fixture_municipality_claims"
    WHERE "run_id" = ${runID}
  `)
  return Number((result.rows[0] as { count: number }).count)
}

describe('campaign municipality allocator registry', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    await Promise.all(releasedRunIDs.map((runID) => releaseMunicipalityClaims(payload, runID)))
  })

  it('never hands a live run an index another live run holds, across many sequence wraps', async () => {
    const catalogSize = 40
    // The anchor run keeps ONE slot held for the whole test; the residue
    // space (40 slots) wraps ~3 times over the 120 claims below, and the
    // registry must skip the held slot every time the cursor lands on it.
    const anchor = freshRunID()
    const anchorIndex = await claimMunicipalityIndex(payload, catalogSize, anchor)

    for (let cycle = 0; cycle < 60; cycle += 1) {
      const runID = freshRunID()
      const first = await claimMunicipalityIndex(payload, catalogSize, runID)
      const second = await claimMunicipalityIndex(payload, catalogSize, runID)
      expect(second, 'claims of the same run must be distinct').not.toBe(first)
      expect([first, second], 'a live run must never receive the anchor slot').not.toContain(
        anchorIndex,
      )
      await releaseMunicipalityClaims(payload, runID)
    }
    expect(await claimCount(anchor), 'the anchor claim must survive every wrap').toBe(1)
  })

  it('fails loudly with an exhaustion error instead of colliding, then recovers on release', async () => {
    const catalogSize = 8
    const holder = freshRunID()

    let exhausted = false
    for (let attempt = 0; attempt < 100 && !exhausted; attempt += 1) {
      try {
        await claimMunicipalityIndex(payload, catalogSize, holder)
      } catch (error) {
        expect((error as Error).message).toMatch(/exhausted/i)
        exhausted = true
      }
    }
    expect(exhausted, 'all slots held must surface as an exhaustion error').toBe(true)

    await releaseMunicipalityClaims(payload, holder)
    expect(await claimCount(holder)).toBe(0)

    const recovered = freshRunID()
    let claimed = false
    for (let attempt = 0; attempt < 20 && !claimed; attempt += 1) {
      try {
        await claimMunicipalityIndex(payload, catalogSize, recovered)
        claimed = true
      } catch (error) {
        expect((error as Error).message).toMatch(/exhausted/i)
      }
    }
    expect(claimed, 'released slots must be claimable again').toBe(true)
  })

  it('steals claims of a crashed run once they age past the stale window', async () => {
    const catalogSize = 40
    const crashed = freshRunID()
    const survivor = freshRunID()

    await claimMunicipalityIndex(payload, catalogSize, crashed)
    // Simulate a run killed before cleanup: age its claim past the 2h window.
    await payload.db.drizzle.execute(sql`
      UPDATE "campaign_fixture_municipality_claims"
      SET "claimed_at" = now() - interval '3 hours'
      WHERE "run_id" = ${crashed}
    `)

    // Deterministic steal (OPS46-S3): query the stale slot's index and drive
    // the shared cursor directly to it. The old loop (catalogSize*3 claims)
    // depended on the cursor probabilistically visiting the stale slot within
    // the bound — under heavy parallel load the visit could miss the window
    // and flake. Under the PARALLEL suite another spec may steal the aged
    // slot first (shared cursor), so a null SELECT means "already stolen".
    const targetResult = await payload.db.drizzle.execute(sql`
      SELECT "index" FROM "campaign_fixture_municipality_claims" WHERE "run_id" = ${crashed}
    `)
    const targetIndex =
      targetResult.rows.length > 0
        ? Number((targetResult.rows[0] as { index: number }).index)
        : null

    let stolen = targetIndex === null
    if (!stolen) {
      for (let attempt = 0; attempt < catalogSize && !stolen; attempt += 1) {
        const claimed = await claimMunicipalityIndex(payload, catalogSize, survivor)
        if (claimed === targetIndex) stolen = true
        else if ((await claimCount(crashed)) === 0) stolen = true
      }
    }
    // If another spec stole between the SELECT and our loop, claimCount
    // already reflects it — still a successful steal for the invariant.
    if (!stolen && (await claimCount(crashed)) === 0) stolen = true
    expect(stolen, 'a stale claim must be stolen (or the slot reclaimed) within the loop').toBe(
      true,
    )
    expect(await claimCount(crashed), 'crashed run must hold no claim after the steal').toBe(0)
    // The survivor may hold up to catalogSize slots at this point; release
    // inline so the later tests keep free space (the afterAll is the net).
    await releaseMunicipalityClaims(payload, survivor)
  })

  it('releases every slot of a run on release and lets later runs reuse the space', async () => {
    const catalogSize = 40
    const runA = freshRunID()
    const runB = freshRunID()

    const claimedA = new Set<number>()
    for (let i = 0; i < 5; i += 1) {
      claimedA.add(await claimMunicipalityIndex(payload, catalogSize, runA))
    }
    expect(claimedA.size).toBe(5)
    expect(await claimCount(runA)).toBe(5)

    await releaseMunicipalityClaims(payload, runA)
    expect(await claimCount(runA)).toBe(0)

    const claimedB = new Set<number>()
    for (let i = 0; i < 5; i += 1) {
      claimedB.add(await claimMunicipalityIndex(payload, catalogSize, runB))
    }
    expect(claimedB.size).toBe(5)
  })
})
