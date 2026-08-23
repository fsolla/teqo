import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

import { assertTestDatabase } from './assertTestDatabase'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
}

/**
 * Seeds a test user for e2e admin tests.
 *
 * Create-if-missing on purpose: specs run fully parallel across workers and
 * share this one user, so a delete-then-create left a window where (a) a
 * concurrent `create` hit the unique email, and (b) the user — and every
 * already-minted admin token — briefly vanished. The credentials are constant
 * (testUser), so a row created by any worker is identical to the one another
 * would create: the unique-conflict loser simply proceeds, and no password
 * reset ever invalidates a live session.
 */
export async function seedTestUser(): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL)
  const payload = await getPayload({ config })

  try {
    await payload.create({
      collection: 'users',
      data: {
        ...testUser,
        roles: ['admin'],
      },
    })
  } catch {
    // A parallel worker already seeded the shared user; nothing to reset.
  }
}
