// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { nextDevArgs, resolveDevPort } from '../../scripts/lib/cli.mjs'

describe('resolveDevPort (OPS40 — next dev ignores env-file PORT)', () => {
  it('no PORT anywhere → null (caller omits -p, Next defaults to 3000)', () => {
    expect(resolveDevPort({})).toBeNull()
    expect(resolveDevPort({ DATABASE_URL: 'x' })).toBeNull()
  })

  it('an empty/whitespace PORT is treated as absent', () => {
    expect(resolveDevPort({ PORT: '' })).toBeNull()
    expect(resolveDevPort({ PORT: '   ' })).toBeNull()
  })

  it('reads the worktree PORT from the merged env (.env.local)', () => {
    expect(resolveDevPort({ PORT: '3140' })).toBe(3140)
  })

  it('trims whitespace around the value', () => {
    expect(resolveDevPort({ PORT: ' 3140 ' })).toBe(3140)
  })

  it('accepts the port range bounds', () => {
    expect(resolveDevPort({ PORT: '1' })).toBe(1)
    expect(resolveDevPort({ PORT: '65535' })).toBe(65535)
  })

  it('fails closed on a non-empty invalid PORT instead of falling back to 3000', () => {
    for (const bad of ['abc', '0', '-1', '65536', '31.5', '12a']) {
      expect(() => resolveDevPort({ PORT: bad })).toThrow(/PORT inválida/)
    }
  })
})

describe('nextDevArgs (port must go as a CLI flag — commander never sees env files)', () => {
  it('passes -p when a port is resolved', () => {
    expect(nextDevArgs(3140)).toEqual(['dev', '-p', '3140'])
  })

  it('omits -p when there is no port (Next default 3000 + allowRetry)', () => {
    expect(nextDevArgs(null)).toEqual(['dev'])
  })
})
