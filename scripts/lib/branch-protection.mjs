/**
 * Pure decision for the main branch protection rule (OPS61).
 *
 * The desired rule is the repo contract: main requires the CI (PR) cascade
 * rollup as the only status check (`strict=false`, 0 reviews). The context is
 * a glob on purpose — Forgejo matches `status_check_contexts` with gobwas/glob
 * against the real commit-status contexts (`CI (PR) / checks (pull_request)` —
 * the ` (event)` suffix is part of the context), so the literal `checks` would
 * match nothing and block every merge.
 */

export const DESIRED_RULE = Object.freeze({
  rule_name: 'main',
  enable_status_check: true,
  status_check_contexts: ['CI (PR) / checks*'],
  enable_push: false,
  required_approvals: 0,
  dismiss_stale_approvals: false,
})

const COMPARED_FIELDS = [
  'rule_name',
  'enable_status_check',
  'status_check_contexts',
  'enable_push',
  'required_approvals',
  'dismiss_stale_approvals',
]

const sameStrings = (have, want) =>
  have.length === want.length &&
  want.every((value) => have.includes(value)) &&
  have.every((value) => want.includes(value))

/**
 * True when the existing rule (from the API, already normalized) matches the
 * desired rule on every compared field — array fields as sets.
 */
export const ruleMatches = (existing, desired = DESIRED_RULE) => {
  if (!existing) return false
  return COMPARED_FIELDS.every((field) => {
    const want = desired[field]
    const have = existing[field]
    if (Array.isArray(want)) return Array.isArray(have) && sameStrings(have, want)
    return have === want
  })
}

/**
 * What to do with the rule: `create` (no rule), `update` (rule exists with
 * drift), `noop` (already compliant). Idempotent re-runs land on `noop`.
 *
 * @param {object|null} existing - normalized rule from the API, or null
 * @param {object} [desired]
 * @returns {{ action: 'create' | 'update' | 'noop' }}
 */
export const planBranchProtectionRule = (existing, desired = DESIRED_RULE) => {
  if (ruleMatches(existing, desired)) return { action: 'noop' }
  return { action: existing ? 'update' : 'create' }
}
