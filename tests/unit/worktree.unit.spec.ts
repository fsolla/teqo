// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  GENERATED_ENV_MARKER,
  devDatabaseForSlot,
  devPortForSlot,
  hashSlotOf,
  isGeneratedDatabaseName,
  numericSlotOfCode,
  testDatabaseForSlot,
  worktreeEnvironment,
} from '../../scripts/lib/worktree-env.mjs'
import { branchNameForIssue, issueCodeAndSubject } from '../../scripts/lib/worktree.mjs'

type TestIssue = {
  number: number
  title: string
  meta?: { id?: string }
}

const issue = (over: Partial<TestIssue> = {}): TestIssue => ({
  number: 1,
  title: 'C15 — FullCalendar em /campanha/agenda',
  meta: { id: 'C15' },
  ...over,
})

describe('issueCodeAndSubject', () => {
  it('extracts the frontmatter id and strips the em-dash prefix', () => {
    expect(issueCodeAndSubject(issue())).toEqual({
      code: 'C15',
      subject: 'FullCalendar em /campanha/agenda',
    })
  })

  it('tolerates dash variants after the code', () => {
    for (const title of ['C15- FullCalendar', 'C15: FullCalendar', 'C15 — FullCalendar']) {
      expect(issueCodeAndSubject(issue({ title })).subject).toBe('FullCalendar')
    }
  })

  it('falls back to the leading title token when the frontmatter id is missing', () => {
    expect(issueCodeAndSubject(issue({ meta: {}, title: 'B164 — Barra de nav' }))).toEqual({
      code: null,
      subject: 'Barra de nav',
    })
  })
})

describe('branchNameForIssue', () => {
  it('builds <code>-<slug> with the repo slugify', () => {
    expect(branchNameForIssue(issue({ title: 'C15 — FullCalendar em /campanha/agenda' }))).toBe(
      'C15-fullcalendar-em-campanha-agenda',
    )
  })

  it('strips accents from the pt-BR title', () => {
    expect(
      branchNameForIssue(
        issue({ title: 'B164 — Barra de navegação inferior no mobile', meta: { id: 'B164' } }),
      ),
    ).toBe('B164-barra-de-navegacao-inferior-no-mobile')
  })

  it('truncates long slugs but keeps the code', () => {
    const title = 'X9 — ' + 'palavra '.repeat(20).trim()
    const branch = branchNameForIssue(issue({ title, meta: { id: 'X9' } }), 30)
    expect(branch.startsWith('X9-')).toBe(true)
    expect(branch.length).toBeLessThanOrEqual(30)
  })

  it('throws when the issue has no code — never invents', () => {
    expect(() => branchNameForIssue(issue({ meta: {}, title: 'Sem código' }))).toThrow(
      /frontmatter/,
    )
  })
})

describe('worktreeEnvironment (per-worktree ports and databases)', () => {
  it('derives slot, port and database names deterministically from the branch', () => {
    const env = worktreeEnvironment({ branch: 'C15-foo', code: 'C15' })
    expect(env).toEqual(worktreeEnvironment({ branch: 'C15-foo', code: 'C15' }))
    expect(env).toEqual({
      slot: 15,
      devPort: 3115,
      devDatabase: 'teqo_wt15',
      testDatabase: 'teqo_wt15_test',
    })
  })

  it('uses the numeric part of the issue code as the preferred slot', () => {
    expect(numericSlotOfCode('C15')).toBe(15)
    expect(numericSlotOfCode('B164')).toBe(164)
    expect(numericSlotOfCode('P3')).toBe(3)
    expect(numericSlotOfCode('E2')).toBe(2)
  })

  it('falls back to a stable hash slot for codes without digits', () => {
    expect(numericSlotOfCode('X')).toBeNull()
    const env = worktreeEnvironment({ branch: 'X-foo', code: 'X' })
    expect(env.slot).toBeGreaterThanOrEqual(0)
    expect(env.slot).toBeLessThanOrEqual(999)
    expect(env).toEqual(worktreeEnvironment({ branch: 'X-foo', code: 'X' }))
    expect(hashSlotOf('X-foo')).toBe(hashSlotOf('X-foo'))
  })

  it('bumps to the next free slot when the preferred one is taken', () => {
    const env = worktreeEnvironment({
      branch: 'A15-bar',
      code: 'A15',
      takenSlots: new Set([15, 16]),
    })
    expect(env.slot).toBe(17)
    expect(env.devPort).toBe(3117)
    expect(env.devDatabase).toBe('teqo_wt17')
    expect(env.testDatabase).toBe('teqo_wt17_test')
  })

  it('keeps port and database names consistent after a bump', () => {
    const env = worktreeEnvironment({ branch: 'C15-foo', code: 'C15', takenSlots: new Set([15]) })
    expect(devPortForSlot(env.slot)).toBe(env.devPort)
    expect(devDatabaseForSlot(env.slot)).toBe(env.devDatabase)
    expect(testDatabaseForSlot(env.slot)).toBe(env.testDatabase)
  })

  it('caps huge codes into the hash range instead of absurd ports', () => {
    const env = worktreeEnvironment({ branch: 'C999999-foo', code: 'C999999' })
    expect(env.slot).toBeLessThanOrEqual(999)
    expect(env.devPort).toBeLessThanOrEqual(4099)
  })

  it('accepts only generated names for CREATE/DROP DATABASE', () => {
    expect(isGeneratedDatabaseName('teqo_wt15')).toBe(true)
    expect(isGeneratedDatabaseName('teqo_wt15_test')).toBe(true)
    expect(isGeneratedDatabaseName('teqo')).toBe(false)
    expect(isGeneratedDatabaseName('teqo_test')).toBe(false)
    expect(isGeneratedDatabaseName('teqo_wt15_extra')).toBe(false)
    expect(isGeneratedDatabaseName('teqo_wt15_test; DROP TABLE x')).toBe(false)
  })

  it('pins the marker used to detect generated env files', () => {
    expect(GENERATED_ENV_MARKER).toContain('generated by pnpm worktree next')
  })
})
