import { describe, expect, it } from 'vitest'

import {
  DESIRED_RULE,
  planBranchProtectionRule,
  ruleMatches,
} from '../../scripts/lib/branch-protection.mjs'

describe('branch-protection rule planning (OPS61)', () => {
  it('plans create when no rule exists', () => {
    expect(planBranchProtectionRule(null).action).toBe('create')
  })

  it('plans noop when the rule already matches', () => {
    const compliant = { ...DESIRED_RULE, branch_name: 'main' }
    expect(planBranchProtectionRule(compliant).action).toBe('noop')
    expect(ruleMatches(compliant)).toBe(true)
  })

  it('plans update when the rule drifts', () => {
    const drift = { ...DESIRED_RULE, status_check_contexts: ['checks'] }
    expect(planBranchProtectionRule(drift).action).toBe('update')
    expect(planBranchProtectionRule(drift).action).not.toBe('noop')
  })

  it('detects drift in the contexts list (extra context)', () => {
    const extra = {
      ...DESIRED_RULE,
      status_check_contexts: ['CI (PR) / checks*', 'migration-lock'],
    }
    expect(planBranchProtectionRule(extra).action).toBe('update')
  })

  it('compares status_check_contexts as a set (order does not matter)', () => {
    const desired = { ...DESIRED_RULE, status_check_contexts: ['a', 'b'] }
    const existing = { ...desired, status_check_contexts: ['b', 'a'] }
    expect(ruleMatches(existing, desired)).toBe(true)
    expect(ruleMatches({ ...desired, status_check_contexts: ['a'] }, desired)).toBe(false)
  })

  it('the desired glob matches the real observed rollup context, not the push rollup', () => {
    // Forgejo matches rule contexts as gobwas globs against the full context
    // string — including the ` (event)` suffix — so the observed rollup is
    // `CI (PR) / checks (pull_request)`. A literal `checks` would never match.
    const glob = DESIRED_RULE.status_check_contexts[0]
    const toRegex = (pattern: string) =>
      new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '.*') + '$')
    const match = toRegex(glob)
    expect(match.test('CI (PR) / checks (pull_request)')).toBe(true)
    expect(match.test('CI / checks (push)')).toBe(false)
    expect(match.test('CI (PR) / checks')).toBe(true)
  })
})
