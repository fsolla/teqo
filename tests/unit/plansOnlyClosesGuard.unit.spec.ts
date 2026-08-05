// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertPlansOnlyPrAllowsBody,
  findIssueClosingKeywords,
  isPlansOnlyDiff,
  isUnderDocsPlans,
} from '../../scripts/lib/plansOnlyClosesGuard.mjs'

/** Body shape from incident PR #115 (plan-only + Closes #114). */
const INCIDENT_PR_115_BODY = `## O que é

Plano B100 — bottom drawer peek nas ações de busca.

Closes #114

## Notas

Registro de plano; implementação em PR separado.`

describe('plansOnlyClosesGuard', () => {
  it('classifies docs/plans paths', () => {
    expect(isUnderDocsPlans('docs/plans/foo.md')).toBe(true)
    expect(isUnderDocsPlans('docs/plans/nested/bar.md')).toBe(true)
    expect(isUnderDocsPlans('docs/plans')).toBe(true)
    expect(isUnderDocsPlans('docs/GUARDRAILS.md')).toBe(false)
    expect(isUnderDocsPlans('src/lib/foo.ts')).toBe(false)
  })

  it('detects plans-only diffs', () => {
    expect(isPlansOnlyDiff(['docs/plans/bottom-drawer-peek-acoes-busca.md'])).toBe(true)
    expect(isPlansOnlyDiff([])).toBe(false)
    expect(isPlansOnlyDiff(['docs/plans/a.md', 'docs/plans/sub/b.md'])).toBe(true)
    expect(isPlansOnlyDiff(['docs/plans/a.md', '.agents/skills/plan-issue/SKILL.md'])).toBe(false)
  })

  it('finds closing keywords case-insensitively', () => {
    expect(findIssueClosingKeywords('Closes #114')).toEqual([{ keyword: 'Closes', number: 114 }])
    expect(findIssueClosingKeywords('fixes #1 and RESOLVES #2')).toEqual([
      { keyword: 'fixes', number: 1 },
      { keyword: 'RESOLVES', number: 2 },
    ])
    expect(findIssueClosingKeywords('Related #114')).toEqual([])
    expect(findIssueClosingKeywords('')).toEqual([])
  })

  it('fails plans-only + Closes (incident #115 fixture)', () => {
    const result = assertPlansOnlyPrAllowsBody({
      paths: ['docs/plans/bottom-drawer-peek-acoes-busca.md'],
      body: INCIDENT_PR_115_BODY,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.closers).toEqual([{ keyword: 'Closes', number: 114 }])
      expect(result.message).toContain('docs/plans/')
      expect(result.message).toContain('Related #N')
    }
  })

  it('allows plans-only + Related', () => {
    expect(
      assertPlansOnlyPrAllowsBody({
        paths: ['docs/plans/foo.md'],
        body: '## O que é\n\nRelated #114',
      }),
    ).toEqual({ ok: true })
  })

  it('allows mixed diff + Closes', () => {
    expect(
      assertPlansOnlyPrAllowsBody({
        paths: ['docs/plans/foo.md', 'scripts/lib/plansOnlyClosesGuard.mjs'],
        body: 'Closes #116',
      }),
    ).toEqual({ ok: true })
  })

  it('allows empty paths (skip)', () => {
    expect(assertPlansOnlyPrAllowsBody({ paths: [], body: 'Closes #1' })).toEqual({ ok: true })
  })

  it('rejects Fixes and Resolves on plans-only PRs', () => {
    for (const body of ['Fixes #42', 'Resolved #7']) {
      const result = assertPlansOnlyPrAllowsBody({
        paths: ['docs/plans/x.md'],
        body,
      })
      expect(result.ok, body).toBe(false)
    }
  })
})
