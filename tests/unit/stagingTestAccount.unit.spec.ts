// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertStagingTestAccountPassword,
  assertStagingTestAccountTarget,
  MIN_STAGING_TEST_ACCOUNT_PASSWORD_LENGTH,
  STAGING_DATABASE_NAME,
  STAGING_TEST_ACCOUNT,
  STAGING_TEST_ACCOUNT_CONFIRM_FLAG,
  STAGING_TEST_ACCOUNT_PASSWORD_ENV,
} from '../../scripts/lib/staging-test-account.mjs'

const STAGING_URL = `postgresql://teqo:teqo@127.0.0.1:5434/${STAGING_DATABASE_NAME}`

const stagingTarget = (overrides = {}) => ({
  databaseUrl: STAGING_URL,
  allowRemoteDb: false,
  teqoEnv: undefined,
  confirm: true,
  ...overrides,
})

describe('staging test account identity (OPS125)', () => {
  it('pins the identity the work-issue verification logs in with', () => {
    expect(STAGING_TEST_ACCOUNT).toEqual({
      name: 'Agente de Teste (staging)',
      email: 'agente-teste@teqo.invalid',
      role: 'coordinator',
    })
    expect(STAGING_DATABASE_NAME).toBe('teqo_staging')
    expect(STAGING_TEST_ACCOUNT_CONFIRM_FLAG).toBe('STAGING_TEST_ACCOUNT_CONFIRM')
    expect(STAGING_TEST_ACCOUNT_PASSWORD_ENV).toBe('STAGING_TEST_ACCOUNT_PASSWORD')
    expect(MIN_STAGING_TEST_ACCOUNT_PASSWORD_LENGTH).toBe(16)
  })
})

describe('assertStagingTestAccountPassword (OPS125)', () => {
  it('accepts a synthetic password at or above the minimum length', () => {
    expect(() => assertStagingTestAccountPassword('x'.repeat(16))).not.toThrow()
    expect(() => assertStagingTestAccountPassword('a-long-synthetic-password')).not.toThrow()
  })

  it('refuses a missing/empty or short password', () => {
    for (const value of [undefined, null, '', 'x'.repeat(15)]) {
      expect(() => assertStagingTestAccountPassword(value)).toThrow(/STAGING_TEST_ACCOUNT_PASSWORD/)
    }
  })
})

describe('assertStagingTestAccountTarget (OPS125 fail-closed guard)', () => {
  it('accepts the staging database with the intent flag set', () => {
    expect(() => assertStagingTestAccountTarget(stagingTarget())).not.toThrow()
  })

  it('accepts a local staging target when the intent flag is set', () => {
    expect(() =>
      assertStagingTestAccountTarget(
        stagingTarget({
          databaseUrl: `postgresql://teqo:teqo@postgres:5432/${STAGING_DATABASE_NAME}`,
        }),
      ),
    ).not.toThrow()
  })

  it('accepts TEQO_ENV=staging and an absent TEQO_ENV', () => {
    expect(() =>
      assertStagingTestAccountTarget(stagingTarget({ teqoEnv: 'staging' })),
    ).not.toThrow()
    expect(() => assertStagingTestAccountTarget(stagingTarget({ teqoEnv: '' }))).not.toThrow()
  })

  it('refuses any database that is not exactly teqo_staging', () => {
    for (const name of ['teqo_1313', 'teqo', 'teqo_test', 'teqo_staging_copy', '']) {
      expect(
        () =>
          assertStagingTestAccountTarget(
            stagingTarget({ databaseUrl: `postgresql://teqo:teqo@127.0.0.1:5434/${name}` }),
          ),
        name,
      ).toThrow(/banco-alvo/)
    }
  })

  it('refuses a missing or unparseable database URL', () => {
    expect(() => assertStagingTestAccountTarget(stagingTarget({ databaseUrl: undefined }))).toThrow(
      /banco-alvo/,
    )
    expect(() =>
      assertStagingTestAccountTarget(stagingTarget({ databaseUrl: 'not a url' })),
    ).toThrow(/banco-alvo/)
  })

  it('refuses a staging-named database on a remote host', () => {
    expect(() =>
      assertStagingTestAccountTarget(
        stagingTarget({
          databaseUrl: `postgresql://teqo:teqo@db.example.com:5432/${STAGING_DATABASE_NAME}`,
        }),
      ),
    ).toThrow(/allowlist local/)
  })

  it('never leaks the connection string (and its password) in the refusal', () => {
    const secret = 'super-secret-db-password'
    let message = ''
    try {
      assertStagingTestAccountTarget(
        stagingTarget({
          databaseUrl: `postgresql://teqo:${secret}@db.example.com:5432/${STAGING_DATABASE_NAME}`,
        }),
      )
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/allowlist local/)
    expect(message).not.toContain(secret)
    expect(message).not.toContain('postgresql://')
  })

  it('refuses a non-postgresql protocol even on a local staging-named target', () => {
    expect(() =>
      assertStagingTestAccountTarget(
        stagingTarget({ databaseUrl: `http://127.0.0.1:5434/${STAGING_DATABASE_NAME}` }),
      ),
    ).toThrow(/protocolo/)
  })

  it('refuses the ALLOW_REMOTE_DB escape', () => {
    expect(() => assertStagingTestAccountTarget(stagingTarget({ allowRemoteDb: true }))).toThrow(
      /ALLOW_REMOTE_DB/,
    )
  })

  it('refuses a TEQO_ENV that is not staging', () => {
    expect(() => assertStagingTestAccountTarget(stagingTarget({ teqoEnv: 'production' }))).toThrow(
      /TEQO_ENV/,
    )
  })

  it('demands the intent flag under a production target', () => {
    expect(() => assertStagingTestAccountTarget(stagingTarget({ confirm: false }))).toThrow(
      /STAGING_TEST_ACCOUNT_CONFIRM/,
    )
  })
})
