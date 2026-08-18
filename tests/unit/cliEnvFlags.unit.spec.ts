// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'

import { ALLOW_REMOTE_DB_FLAG, isRemoteDbOverrideSet, isTruthyEnv } from '../../scripts/lib/cli.mjs'

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
