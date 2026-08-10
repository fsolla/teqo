import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import { MINIMAL_CAMPAIGN_USERS } from '../../scripts/lib/seed-minimal-manifest.mjs'
import config from '../../src/payload.config.js'

/**
 * OPS28 — parity guard between the worktree provisioning and CI.
 *
 * CI runs `pnpm migrate && pnpm db:seed:minimal` before e2e; worktrees
 * provisioned by `pnpm worktree next`/`plan` now do the same (OPS28). This
 * spec pins the outcome on the TEST DATABASE: if the seed is missing, the
 * suite fails here with a clear message instead of red specs that "work in
 * CI" (the exact pattern TECH-DEBT row 19 calls out as masking real failures).
 *
 * The check is the seed's INDELIBLE evidence, deliberately NOT the
 * municipality priority pins: the e2e fixture cleanup resets `priority` on
 * the municipalities it touches (round-robin over the catalog with a
 * persistent sequence), so after repeated suite runs against the same
 * worktree database a pin can legitimately be back to `normal` — that is
 * not "seed missing". The seed's campaign users (synthetic, stable email /
 * username, created only by `db:seed:minimal`, never deleted by the e2e
 * cleanup, which owns only rows the fixtures created) cannot die that way:
 * their presence is exactly "the minimal seed ran here".
 *
 * Runs in the `setup` Playwright project (matches `setup.e2e.spec.ts`), which
 * the `campaign` project depends on: a failure here skips the dependent
 * projects with this message instead of running a confusing suite.
 */

const SEED_MISSING_MESSAGE =
  'O seed mínimo não foi aplicado neste banco de teste. Rode `pnpm migrate && pnpm db:seed:minimal` ' +
  '(worktrees provisionados pelo `pnpm worktree next`/`plan` já fazem isso; um banco migrado cru ' +
  'não tem nenhum dado do seed).'

test('test database carries the minimal seed (run pnpm migrate && pnpm db:seed:minimal)', async () => {
  expect(MINIMAL_CAMPAIGN_USERS.length).toBeGreaterThan(0)

  let payload
  try {
    payload = await getPayload({ config })
  } catch (error) {
    // A never-migrated database fails on schema access, not on missing rows —
    // surface the same actionable message instead of a raw PG error.
    throw new Error(
      `${SEED_MISSING_MESSAGE}\n(detalhe: o banco pode nem estar migrado — ${
        error instanceof Error ? error.message : String(error)
      })`,
    )
  }
  try {
    for (const user of MINIMAL_CAMPAIGN_USERS) {
      const { docs } = await payload.find({
        collection: 'campaignUser',
        where: user.email
          ? { email: { equals: user.email } }
          : { username: { equals: user.username } },
        depth: 0,
        limit: 1,
        pagination: false,
      })
      const found = docs[0]
      expect(
        found,
        `Usuário do seed ${user.email ?? user.username} ausente no banco de teste — ${SEED_MISSING_MESSAGE}`,
      ).toBeDefined()
    }
  } finally {
    await payload.db.destroy?.()
  }
})
