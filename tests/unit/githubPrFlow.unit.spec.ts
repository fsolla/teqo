import { describe, expect, it } from 'vitest'

import {
  AUDIT_HEAD_PREFIX,
  CURSOR_HEAD_PREFIX,
  automergeArmingToken,
  decideAutomergeAction,
  isAuditHead,
  isCursorHead,
} from '../../scripts/lib/github-pr-flow.mjs'

const pr = (overrides: Record<string, unknown> = {}) => ({
  number: 4,
  title: 't',
  body: '',
  state: 'OPEN',
  merged: false,
  draft: false,
  mergeable: true,
  nodeId: 'PR_x',
  head: { ref: 'OPS71-x', sha: 'abc' },
  base: { ref: 'main' },
  ...overrides,
})

describe('github-pr-flow automerge decision (OPS71)', () => {
  it('skips a null PR', () => {
    expect(decideAutomergeAction(null).action).toBe('skip')
  })

  it('skips an already merged PR (idempotent)', () => {
    expect(decideAutomergeAction(pr({ merged: true, state: 'CLOSED' })).action).toBe('skip')
  })

  it('skips a closed PR without merge', () => {
    expect(decideAutomergeAction(pr({ state: 'CLOSED' })).action).toBe('skip')
  })

  it('skips a PR whose base is not main', () => {
    expect(decideAutomergeAction(pr({ base: { ref: 'stage' } })).action).toBe('skip')
  })

  it('enables auto-merge on a ready PR to main', () => {
    const verdict = decideAutomergeAction(pr())
    expect(verdict.action).toBe('enable-auto-merge')
    expect(verdict.reason).toBe('ready')
  })

  it('marks a cursor/* draft ready (OPS57 pool flow)', () => {
    const verdict = decideAutomergeAction(
      pr({ draft: true, head: { ref: `${CURSOR_HEAD_PREFIX}abc-123`, sha: 'abc' } }),
    )
    expect(verdict.action).toBe('mark-ready')
  })

  it('skips any non-cursor/* draft — the actor veto (OPS57)', () => {
    const verdict = decideAutomergeAction(
      pr({ draft: true, head: { ref: 'plans/ops71-x', sha: 'abc' } }),
    )
    expect(verdict.action).toBe('skip')
    expect(verdict.reason).toBe('draft-veto')
  })

  it('isCursorHead only matches the cursor/ prefix', () => {
    expect(isCursorHead('cursor/abc-123')).toBe(true)
    expect(isCursorHead('OPS71-x')).toBe(false)
    expect(isCursorHead('')).toBe(false)
    expect(isCursorHead(undefined)).toBe(false)
  })

  it('skips a ready audit/* PR — the single-PR overnight delivery (OPS98)', () => {
    const verdict = decideAutomergeAction(
      pr({ head: { ref: `${AUDIT_HEAD_PREFIX}pass-6`, sha: 'abc' } }),
    )
    expect(verdict).toEqual({ action: 'skip', reason: 'audit-veto' })
  })

  it('audit/* veto dominates the draft logic — a draft audit/* never becomes mark-ready', () => {
    const verdict = decideAutomergeAction(
      pr({ draft: true, head: { ref: `${AUDIT_HEAD_PREFIX}pass-6`, sha: 'abc' } }),
    )
    expect(verdict).toEqual({ action: 'skip', reason: 'audit-veto' })
  })

  it('isAuditHead only matches the exact audit/ prefix', () => {
    expect(isAuditHead('audit/pass-6')).toBe(true)
    expect(isAuditHead('OPS71-x')).toBe(false)
    expect(isAuditHead('cursor/x')).toBe(false)
    expect(isAuditHead('auditoria/x')).toBe(false)
    expect(isAuditHead('')).toBe(false)
    expect(isAuditHead(undefined)).toBe(false)
  })

  it('the merge contract has no poll path: ready always arms native auto-merge', () => {
    // OPS64 pin, GitHub shape: the Forgejo rollup-lie bug is structural here
    // (single job → one honest check-run), and the server only merges with
    // required checks green — so the decision surface is exactly this.
    const actions = [
      decideAutomergeAction(pr()).action,
      decideAutomergeAction(pr({ draft: true, head: { ref: 'cursor/x', sha: 'a' } })).action,
      decideAutomergeAction(pr({ head: { ref: 'audit/pass-6', sha: 'a' } })).action,
    ]
    expect(actions).toEqual(['enable-auto-merge', 'mark-ready', 'skip'])
  })

  it('automergeArmingToken accepts a non-empty AUTOMERGE_PAT (OPS71-FLIP)', () => {
    expect(automergeArmingToken({ AUTOMERGE_PAT: 'ghp_abc' })).toEqual({
      ok: true,
      token: 'ghp_abc',
    })
  })

  it('automergeArmingToken fails closed without the PAT — never falls back to the run token', () => {
    const verdict = automergeArmingToken({})
    expect(verdict.ok).toBe(false)
    expect(verdict.ok === false && verdict.reason).toContain('AUTOMERGE_PAT')
  })

  it('automergeArmingToken treats an empty-string PAT as missing', () => {
    expect(automergeArmingToken({ AUTOMERGE_PAT: '' }).ok).toBe(false)
  })
})
