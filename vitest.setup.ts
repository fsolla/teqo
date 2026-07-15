// Load the isolated test environment — NEVER .env / .env.local, which point at
// the production database. `override: true` guarantees the test database wins
// even if a prod DATABASE_URL is already exported in the shell.
import { config as loadEnv } from 'dotenv'

import { assertTestDatabase } from './tests/helpers/assertTestDatabase'

loadEnv({ path: '.env.test', override: true })

// Fail closed: refuse to run the (destructive) suite against a non-test database.
assertTestDatabase(process.env.DATABASE_URL)
