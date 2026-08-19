import { describe, expect, it } from 'vitest'

import {
  DESIRED_RULE,
  REQUIRED_CHECK_CONTEXT,
  planBranchProtectionRule,
  ruleMatches,
} from '../../scripts/lib/github-branch-protection.mjs'

const compliant = {
  required_status_checks: { strict: false, contexts: [REQUIRED_CHECK_CONTEXT] },
  enforce_admins: true,
  required_pull_request_reviews: null,
}

describe('github branch-protection rule planning (OPS71)', () => {
  it('plans create when no rule exists', () => {
    expect(planBranchProtectionRule(null).action).toBe('create')
  })

  it('plans noop when the rule already matches', () => {
    expect(planBranchProtectionRule(compliant).action).toBe('noop')
    expect(ruleMatches(compliant)).toBe(true)
  })

  it('plans update when enforce_admins is off (admin bypass = red-CI merge path)', () => {
    const drift = { ...compliant, enforce_admins: false }
    expect(planBranchProtectionRule(drift).action).toBe('update')
    expect(ruleMatches(drift)).toBe(false)
  })

  it('plans update when the required check context drifts', () => {
    const drift = {
      ...compliant,
      required_status_checks: { strict: false, contexts: ['CI (PR) / checks (pull_request)'] },
    }
    expect(planBranchProtectionRule(drift).action).toBe('update')
  })

  it('plans update when a second check is required', () => {
    const extra = {
      ...compliant,
      required_status_checks: {
        strict: false,
        contexts: [REQUIRED_CHECK_CONTEXT, 'migration-lock'],
      },
    }
    expect(planBranchProtectionRule(extra).action).toBe('update')
  })

  it('plans update when strict becomes true', () => {
    const drift = {
      ...compliant,
      required_status_checks: { strict: true, contexts: [REQUIRED_CHECK_CONTEXT] },
    }
    expect(planBranchProtectionRule(drift).action).toBe('update')
  })

  it('plans update when pull request reviews are required (blocks auto-merge)', () => {
    const drift = {
      ...compliant,
      required_pull_request_reviews: { required_approving_review_count: 1 },
    }
    expect(planBranchProtectionRule(drift).action).toBe('update')
  })

  it('plans update when status checks are missing entirely', () => {
    const drift = { ...compliant, required_status_checks: null }
    expect(planBranchProtectionRule(drift).action).toBe('update')
  })

  it('compares contexts as a set (order does not matter)', () => {
    const existing = {
      ...compliant,
      required_status_checks: { strict: false, contexts: [REQUIRED_CHECK_CONTEXT] },
    }
    expect(ruleMatches(existing)).toBe(true)
  })

  it('the desired rule names exactly the check-run a single `checks` job posts', () => {
    // GitHub check-run naming: <workflow name> / <job name>. The ci-pr.yml
    // workflow is named `CI (PR)` and its single job is `checks` (OPS62) —
    // the required check literal must match that exact check-run.
    const check = DESIRED_RULE.required_status_checks.checks[0]
    expect(check.context).toBe('CI (PR) / checks')
    expect(DESIRED_RULE.required_status_checks.checks).toHaveLength(1)
  })
})
