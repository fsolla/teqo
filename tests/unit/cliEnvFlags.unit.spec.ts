// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'

import {
  ALLOW_REMOTE_DB_FLAG,
  databaseHostname,
  databaseName,
  isLocalDatabaseUrl,
  isRemoteDbOverrideSet,
  isTruthyEnv,
  mirroredMediaRequired,
  requiresWriteConfirm,
} from '../../scripts/lib/cli.mjs'

describe('isTruthyEnv (OPS52-media-guard — one spelling of the true/1 intent-flag semantics)', () => {
  it('accepts exactly true and 1', () => {
    expect(isTruthyEnv('true')).toBe(true)
    expect(isTruthyEnv('1')).toBe(true)
  })

  it('refuses every other value — including case variants and empty/absent', () => {
    for (const value of ['TRUE', 'True', 'yes', 'on', '0', 'false', '', ' ', '2']) {
      expect(isTruthyEnv(value), JSON.stringify(value)).toBe(false)
    }
    expect(isTruthyEnv(undefined)).toBe(false)
  })
})

describe('isRemoteDbOverrideSet (behavior preserved through the delegation refactor)', () => {
  const original = process.env[ALLOW_REMOTE_DB_FLAG]

  afterEach(() => {
    if (original === undefined) delete process.env[ALLOW_REMOTE_DB_FLAG]
    else process.env[ALLOW_REMOTE_DB_FLAG] = original
  })

  it('still passes for true/1', () => {
    process.env[ALLOW_REMOTE_DB_FLAG] = 'true'
    expect(isRemoteDbOverrideSet()).toBe(true)
    process.env[ALLOW_REMOTE_DB_FLAG] = '1'
    expect(isRemoteDbOverrideSet()).toBe(true)
  })

  it('still refuses TRUE/yes/empty/absent', () => {
    for (const value of ['TRUE', 'yes', '', '0', 'false']) {
      process.env[ALLOW_REMOTE_DB_FLAG] = value
      expect(isRemoteDbOverrideSet(), JSON.stringify(value)).toBe(false)
    }
    delete process.env[ALLOW_REMOTE_DB_FLAG]
    expect(isRemoteDbOverrideSet()).toBe(false)
  })
})

describe('databaseName (OPS125 — the one spelling shared by the DB-name guards)', () => {
  it('reads the decoded database name and refuses missing/invalid URLs', () => {
    expect(databaseName('postgresql://teqo:teqo@localhost:5432/teqo_staging')).toBe('teqo_staging')
    expect(databaseName('postgresql://teqo:teqo@postgres:5432/teqo_1313')).toBe('teqo_1313')
    expect(databaseName('postgresql://teqo:teqo@localhost:5432/teqo%5Fwt155')).toBe('teqo_wt155')
    expect(databaseName('postgresql://teqo:teqo@localhost:5432/')).toBe('')
    expect(databaseName(undefined)).toBeNull()
    expect(databaseName('not a url')).toBeNull()
    expect(databaseName('postgresql://teqo:teqo@localhost:5432/%E0%A4%A')).toBeNull()
  })
})

describe('databaseHostname / isLocalDatabaseUrl (C155)', () => {
  it('reads the hostname and refuses missing/invalid connection strings', () => {
    expect(databaseHostname('postgresql://teqo:teqo@localhost:5432/teqo_wt155')).toBe('localhost')
    expect(databaseHostname('postgresql://user:pw@postgres:5432/teqo_1313')).toBe('postgres')
    expect(databaseHostname(undefined)).toBeNull()
    expect(databaseHostname('not a url')).toBeNull()
  })

  it('accepts the local allowlist and refuses every other host', () => {
    expect(isLocalDatabaseUrl('postgresql://teqo:teqo@localhost:5432/teqo_wt155')).toBe(true)
    expect(isLocalDatabaseUrl('postgresql://teqo:teqo@127.0.0.1:5433/teqo_1313')).toBe(true)
    expect(isLocalDatabaseUrl('postgresql://teqo:teqo@postgres:5432/teqo_1313')).toBe(true)
    expect(isLocalDatabaseUrl('postgresql://teqo:teqo@db.example.com:5432/teqo_1313')).toBe(false)
    expect(isLocalDatabaseUrl(undefined)).toBe(false)
  })
})

describe('mirroredMediaRequired (C225 production media guard)', () => {
  it('requires mirrored media for a production target without S3', () => {
    expect(
      mirroredMediaRequired({
        nodeEnv: 'production',
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5433/teqo_1313',
        allowRemoteDb: false,
        s3Enabled: false,
      }),
    ).toBe(true)
  })

  it('allows a production target when S3 is enabled', () => {
    expect(
      mirroredMediaRequired({
        nodeEnv: 'production',
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5433/teqo_1313',
        allowRemoteDb: false,
        s3Enabled: true,
      }),
    ).toBe(false)
  })

  it('does not require mirrored media for a local development target', () => {
    expect(
      mirroredMediaRequired({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt155',
        allowRemoteDb: false,
        s3Enabled: false,
      }),
    ).toBe(false)
  })

  it('does not trust a non-boolean S3 capability value', () => {
    const options = {
      nodeEnv: 'production' as const,
      databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5433/teqo_1313',
      allowRemoteDb: false,
      s3Enabled: false,
    }
    Object.assign(options, { s3Enabled: 'false' })

    expect(mirroredMediaRequired(options)).toBe(true)
  })

  it('requires mirrored media for remote and override targets', () => {
    expect(
      mirroredMediaRequired({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://teqo:teqo@db.example.com:5432/teqo_1313',
        allowRemoteDb: false,
        s3Enabled: false,
      }),
    ).toBe(true)
    expect(
      mirroredMediaRequired({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt155',
        allowRemoteDb: true,
        s3Enabled: false,
      }),
    ).toBe(true)
  })
})

describe('requiresWriteConfirm (C155 write guard)', () => {
  it('stays quiet for a local target in dev/test', () => {
    expect(
      requiresWriteConfirm({
        nodeEnv: 'test',
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt155',
        allowRemoteDb: false,
      }),
    ).toBe(false)
  })

  it('demands confirmation under NODE_ENV=production even through the local proxy', () => {
    expect(
      requiresWriteConfirm({
        nodeEnv: 'production',
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5433/teqo_1313',
        allowRemoteDb: false,
      }),
    ).toBe(true)
  })

  it('demands confirmation for a remote host or the ALLOW_REMOTE_DB escape', () => {
    expect(
      requiresWriteConfirm({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://teqo:teqo@db.example.com:5432/teqo_1313',
        allowRemoteDb: false,
      }),
    ).toBe(true)
    expect(
      requiresWriteConfirm({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt155',
        allowRemoteDb: true,
      }),
    ).toBe(true)
  })

  it('fails closed on a missing/unparseable URL and keeps the exact-match env semantics', () => {
    // `null`/empty/`'not a url'` never reach LOCAL_HOSTS; `undefined` would
    // fall back to the real process env by design (the callers' default).
    expect(requiresWriteConfirm({ nodeEnv: 'development', databaseUrl: null })).toBe(true)
    expect(requiresWriteConfirm({ nodeEnv: 'development', databaseUrl: '' })).toBe(true)
    expect(requiresWriteConfirm({ nodeEnv: 'development', databaseUrl: 'not a url' })).toBe(true)
    // `Production` (capitalized) is not the env file's value — no case-folding.
    expect(
      requiresWriteConfirm({
        nodeEnv: 'Production',
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt155',
        allowRemoteDb: false,
      }),
    ).toBe(false)
  })
})
