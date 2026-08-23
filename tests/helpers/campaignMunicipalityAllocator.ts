import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Cross-process municipality allocator — shared by the int
 * (`campaignFixtures.ts`) and e2e (`campaignE2EFixtures.ts`) suites.
 *
 * Deliberately VITEST-FREE: the e2e fixture imports this module inside the
 * Playwright process, and a vitest import there crashes at load time (same
 * rule as `campaignResidue.ts` — OPS45).
 *
 * The Postgres sequence hands out globally unique catalog indexes across
 * parallel workers, but it is NEVER reset: worktree test databases are
 * persistent, and a full int + e2e cycle claims ~505 of the 435 catalog
 * slots, so the residue space wraps on every cycle. Once it wraps, two
 * concurrent runs can receive the SAME index — and the purge-on-claim
 * contract turns that collision into corruption (each run deletes the other
 * run's live rows). The claims registry below keeps the sequence as the
 * cursor but makes a claim exclusive per LIVE run:
 *
 *  - claim: nextval → index → INSERT (index, run_id) ON CONFLICT DO NOTHING;
 *    a conflict means a live run holds the slot, so skip to the next value;
 *  - stale steal: a claim older than STALE_CLAIM_WINDOW belongs to a
 *    CRASHED run (its cleanup never ran), so it is deleted and the slot is
 *    reclaimed — without this, one aborted run would block slots for hours;
 *  - release: the fixture deletes its own rows at cleanup, so the slots
 *    become claimable again for later runs;
 *  - exhaustion: all slots held by fresh claims → clear error instead of a
 *    silent collision.
 */
const ALLOCATION_SEQUENCE = 'campaign_fixture_municipality_alloc'
const ALLOCATION_CLAIMS = 'campaign_fixture_municipality_claims'
const STALE_CLAIM_WINDOW = "interval '2 hours'"

// Identifiers in the `sql` templates below are INLINE LITERALS on purpose:
// `${}` in a drizzle template is a bound parameter, never an identifier.
const claimsTable = `"${ALLOCATION_CLAIMS}"`

let allocatorReady: Promise<void> | undefined

const ensureAllocatorSchema = (payload: Payload): Promise<void> => {
  allocatorReady ??= Promise.all([
    payload.db.drizzle.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${ALLOCATION_SEQUENCE}"`)),
    payload.db.drizzle.execute(
      sql.raw(`
        CREATE TABLE IF NOT EXISTS ${claimsTable} (
          "index" integer PRIMARY KEY,
          "run_id" text NOT NULL,
          "claimed_at" timestamptz NOT NULL DEFAULT now()
        )
      `),
    ),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      // IF NOT EXISTS still races across parallel workers (pg_class unique
      // violation, SQLSTATE 23505) — the objects exist, which is all we need.
      if ((error as { code?: string }).code === '23505') return undefined
      throw error
    })
  return allocatorReady
}

const nextAllocationValue = async (payload: Payload): Promise<number> => {
  const result = await payload.db.drizzle.execute(
    sql.raw(`SELECT nextval('"${ALLOCATION_SEQUENCE}"') AS "value"`),
  )
  return Number((result.rows[0] as { value: string | number }).value)
}

const tryClaimIndex = async (payload: Payload, index: number, runID: string): Promise<boolean> => {
  const result = await payload.db.drizzle.execute(sql`
    INSERT INTO ${sql.raw(claimsTable)} ("index", "run_id")
    VALUES (${index}, ${runID})
    ON CONFLICT ("index") DO NOTHING
    RETURNING "index"
  `)
  return result.rows.length > 0
}

const tryStealStaleClaim = async (payload: Payload, index: number): Promise<boolean> => {
  const result = await payload.db.drizzle.execute(sql`
    DELETE FROM ${sql.raw(claimsTable)}
    WHERE "index" = ${index} AND "claimed_at" < now() - ${sql.raw(STALE_CLAIM_WINDOW)}
    RETURNING "index"
  `)
  return result.rows.length > 0
}

/**
 * A catalog index that no LIVE run holds. Never returns an index that a
 * concurrently running fixture still owns, even after the sequence wraps —
 * the claim only lands when the INSERT wins. One run may hold at most
 * `catalogSize` slots at once (its own claims are live); claiming past that
 * with the same runID exhausts, which is correct — real fixtures release at
 * each test's cleanup.
 */
export const claimMunicipalityIndex = async (
  payload: Payload,
  catalogSize: number,
  runID: string,
): Promise<number> => {
  await ensureAllocatorSchema(payload)
  for (let attempt = 0; attempt < catalogSize; attempt += 1) {
    const index = (await nextAllocationValue(payload)) % catalogSize
    if (await tryClaimIndex(payload, index, runID)) return index
    if (await tryStealStaleClaim(payload, index)) {
      if (await tryClaimIndex(payload, index, runID)) return index
    }
  }
  throw new Error(
    `Municipality allocator exhausted: all ${catalogSize} catalog slots are held by ` +
      `live test runs. Stale claims from crashed runs expire after 2 hours.`,
  )
}

/**
 * Frees every slot a run claimed (runID is per fixture instance — one test).
 * Called from the fixture cleanup; the claim is held from claim until the
 * test's rows are purged, so releasing here cannot collide with the live
 * owner (there is none by definition).
 */
export const releaseMunicipalityClaims = async (payload: Payload, runID: string): Promise<void> => {
  await payload.db.drizzle.execute(sql`
    DELETE FROM ${sql.raw(claimsTable)}
    WHERE "run_id" = ${runID}
  `)
}
