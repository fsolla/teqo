import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Pass 6 (2026-08-25, miss #909): the /testing-audit skill used to disarm the
// safety-net auto-merge with a manual `gh pr merge --disable-auto` sequence
// whose order depended on the agent remembering it — the 1st night merged its
// PR without the human (OPS96 errata). The disarm is now deterministic via
// `scripts/testing-audit-disarm.mjs` (create → disarm → verify-null, atomic).
// This spec is the class-3 guard of that wiring: if the skill stops pointing
// at the script, the build fails and the disarm goes back to judgment-only.

const repoRoot = process.cwd()
const skillPath = resolve(repoRoot, '.agents/skills/testing-audit/SKILL.md')
const scriptPath = resolve(repoRoot, 'scripts/testing-audit-disarm.mjs')

describe('testing-audit disarm wiring (miss #909)', () => {
  it('keeps the /testing-audit skill wired to the deterministic disarm script', () => {
    const skill = readFileSync(skillPath, 'utf8')
    expect(
      skill,
      'Fase 4/5 da skill /testing-audit deve invocar scripts/testing-audit-disarm.mjs (o desarme manual por gh é o miss #909)',
    ).toContain('scripts/testing-audit-disarm.mjs')
  })

  it('keeps the disarm script present in the repo', () => {
    expect(existsSync(scriptPath), 'scripts/testing-audit-disarm.mjs deve existir').toBe(true)
  })
})
