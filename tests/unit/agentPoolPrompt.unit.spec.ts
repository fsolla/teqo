// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { buildPoolWorkerPrompt, extractPlanPath } from '../../scripts/lib/agent-pool-prompt.mjs'

const prompt = buildPoolWorkerPrompt({
  issueNumber: 42,
  issueTitle: 'B91 — Ajustar badge',
  issueId: 'B91',
  planPath: 'docs/plans/ajustar-badge.md',
  modelSlug: 'kimi-k3-low',
})

describe('buildPoolWorkerPrompt', () => {
  it('tells the worker the issue is pre-claimed and forbids agent:claim', () => {
    expect(prompt).toContain('#42')
    expect(prompt).toContain('NÃO rode `pnpm agent:claim`')
    expect(prompt).toContain('in-progress')
  })

  it('points workers at agent-work-issue and forbids treating intention as engineering contract', () => {
    expect(prompt).toContain('agent-work-issue/SKILL.md')
    expect(prompt).toContain('*-impl.md')
    expect(prompt).toContain('plano de intenção como contrato de engenharia')
  })

  it('pins the PR contract: base main, Closes #N, changelog entry, rebase auto-merge, CI watch', () => {
    expect(prompt).toContain('gh pr create --base main')
    expect(prompt).toContain('Closes #42')
    expect(prompt).toContain('changelog:build')
    expect(prompt).toContain('gh pr merge --auto --rebase')
    expect(prompt).toContain('gh pr checks <PR> --watch')
  })

  it('restates the hard prohibitions (sem DB remota, escopo da Issue)', () => {
    expect(prompt).toContain('DATABASE_URL')
    expect(prompt).toContain('ALLOW_REMOTE_DB')
    expect(prompt).toContain('trabalhar fora da Issue #42')
  })

  it('links the plan and the declared model when present', () => {
    expect(prompt).toContain('docs/plans/ajustar-badge.md')
    expect(prompt).toContain('kimi-k3-low')
  })

  it('notes the pool default when the issue declares no model', () => {
    const noModel = buildPoolWorkerPrompt({
      issueNumber: 7,
      issueTitle: 'x',
      issueId: null,
      planPath: null,
      modelSlug: null,
    })
    expect(noModel).toContain('composer-2.5')
    expect(noModel).toContain('não há plano linkado')
  })
})

describe('extractPlanPath', () => {
  it('pulls the first docs/plans path from the body', () => {
    expect(
      extractPlanPath('Plano: [`docs/plans/foo-bar.md`](docs/plans/foo-bar.md)\n\nmais texto'),
    ).toBe('docs/plans/foo-bar.md')
  })

  it('returns null when the body has no plan link', () => {
    expect(extractPlanPath('spec solta')).toBeNull()
    expect(extractPlanPath('')).toBeNull()
  })
})
