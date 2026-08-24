// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { defaultGatewayHost, LOCAL_HOSTS, TEST_DATABASE_NAME_RE } from '../../scripts/lib/cli.mjs'

describe('LOCAL_HOSTS (OPS50/OPS62 — self-hosted runner services by name, legacy gateway)', () => {
  it('still contains the canonical static hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'postgres']) {
      expect(LOCAL_HOSTS.has(host)).toBe(true)
    }
  })

  it('admits the job-network service names (OPS62 X1: no host publish)', () => {
    expect(LOCAL_HOSTS.has('postgres-int')).toBe(true)
    expect(LOCAL_HOSTS.has('postgres-build')).toBe(true)
  })

  it('admits the machine default gateway when it is RFC1918 (Linux CI bridge)', () => {
    const gateway = defaultGatewayHost()
    if (gateway) {
      // The Forgejo runner published the job's postgres service on the bridge
      // gateway IP before OPS62; assertLocalDatabase must still accept it.
      expect(LOCAL_HOSTS.has(gateway)).toBe(true)
    }
  })

  it('never admits public or loopback hosts', () => {
    expect(LOCAL_HOSTS.has('8.8.8.8')).toBe(false)
    expect(LOCAL_HOSTS.has('127.0.0.2')).toBe(false)
    expect(LOCAL_HOSTS.has('203.0.113.1')).toBe(false)
    expect(LOCAL_HOSTS.has('postgres-prod')).toBe(false)
  })
})

describe('TEST_DATABASE_NAME_RE (OPS88 — the one _test name contract, shared with db:reset)', () => {
  it('admits the suite database and per-worktree test databases', () => {
    expect(TEST_DATABASE_NAME_RE.test('teqo_test')).toBe(true)
    expect(TEST_DATABASE_NAME_RE.test('teqo_wt88_test')).toBe(true)
    expect(TEST_DATABASE_NAME_RE.test('teqo_wt999_test')).toBe(true)
  })

  it('rejects the dev database and any non-test name', () => {
    expect(TEST_DATABASE_NAME_RE.test('teqo')).toBe(false)
    expect(TEST_DATABASE_NAME_RE.test('teqo_wt88')).toBe(false)
    expect(TEST_DATABASE_NAME_RE.test('teqo_prod')).toBe(false)
    expect(TEST_DATABASE_NAME_RE.test('teqo_test2')).toBe(false)
    expect(TEST_DATABASE_NAME_RE.test('teqo_Test_test')).toBe(false)
    expect(TEST_DATABASE_NAME_RE.test('')).toBe(false)
  })
})
