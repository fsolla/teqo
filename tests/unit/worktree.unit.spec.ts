// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  devDatabaseForSlot,
  devPortForSlot,
  GENERATED_ENV_MARKER,
  hashSlotOf,
  isGeneratedDatabaseName,
  numericSlotOfCode,
  testDatabaseForSlot,
  worktreeEnvFileContents,
  worktreeEnvironment,
} from '../../scripts/lib/worktree-env.mjs'
import {
  branchNameForIssue,
  issueCodeAndSubject,
  OPENCODE_PRESET_MODEL,
  OPENCODE_SKILL_COMMAND_BY_PURPOSE,
  opencodeLaunchDirective,
  PLAN_BRANCH_PREFIX,
  planBranchName,
  WORKTREE_TERMINAL_ENV,
} from '../../scripts/lib/worktree.mjs'

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

describe('planBranchName (per-invocation planning worktrees)', () => {
  it('no bag → first free sequential plans/plan-issue-<n>', () => {
    expect(planBranchName({})).toBe('plans/plan-issue-1')
    expect(planBranchName({ bag: '' })).toBe('plans/plan-issue-1')
    expect(planBranchName({ bag: '   ' })).toBe('plans/plan-issue-1')
  })

  it('no bag → skips taken sequential names (parallel sessions)', () => {
    const taken = new Set(['plans/plan-issue-1', 'plans/plan-issue-2'])
    expect(planBranchName({ taken })).toBe('plans/plan-issue-3')
  })

  it('named bag → plans/plan-issue-<slug> when free', () => {
    expect(planBranchName({ bag: 'Agenda eleitoral' })).toBe('plans/plan-issue-agenda-eleitoral')
  })

  it('named bag whose name is taken → suffixed -2, -3, …', () => {
    const taken = new Set(['plans/plan-issue-agenda'])
    expect(planBranchName({ bag: 'agenda', taken })).toBe('plans/plan-issue-agenda-2')

    taken.add('plans/plan-issue-agenda-2')
    expect(planBranchName({ bag: 'agenda', taken })).toBe('plans/plan-issue-agenda-3')
  })

  it('each invocation returns a different branch for the same bag (live name)', () => {
    const first = planBranchName({ bag: 'municipios' })
    const second = planBranchName({ bag: 'municipios', taken: new Set([first]) })
    expect(second).toBe(`${first}-2`)
  })

  it('never collides with a `next` branch (uppercase-led <Code>-<slug>)', () => {
    const taken = new Set(['C15-fullcalendar-em-campanha-agenda'])
    for (const bag of ['agenda', 'municipios', 'C15']) {
      const branch = planBranchName({ bag, taken })
      expect(branch).toMatch(/^plans\/plan-issue/)
      expect(branch).not.toMatch(/^[A-Z][A-Za-z0-9]*-/)
    }
  })

  it('a numeric bag shares the sequential namespace (uniform)', () => {
    expect(planBranchName({ bag: '3' })).toBe('plans/plan-issue-3')
  })
})

describe('opencodeLaunchDirective (terminal-only opencode launch, OPS26)', () => {
  const dir = '/home/fsolla/.cursor/worktrees/teqo/OPS26-foo'

  it('returns null outside the terminal — the /worktree command never launches a TUI', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'next' })).toBeNull()
    expect(opencodeLaunchDirective({ dir, purpose: 'plan', terminal: false })).toBeNull()
  })

  it('next launches with the preset model, --auto and the /work-issue command sent', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'next', terminal: true })).toBe(
      `launch opencode ${dir} --model deepseek/deepseek-v4-flash --auto --prompt /work-issue`,
    )
  })

  it('plan launches with the same presets but NO prompt (no prefill-without-submit)', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true })).toBe(
      `launch opencode ${dir} --model deepseek/deepseek-v4-flash --auto`,
    )
  })

  it('pins the preset constants — changing the model is editing a constant', () => {
    expect(OPENCODE_PRESET_MODEL).toBe('deepseek/deepseek-v4-flash')
    expect(WORKTREE_TERMINAL_ENV).toBe('WORKTREE_TERMINAL')
    expect(OPENCODE_SKILL_COMMAND_BY_PURPOSE).toEqual({ next: '/work-issue', plan: null })
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

  it('plan worktree derives a stable hashed slot and never collides with `next`', () => {
    const branch = planBranchName({ bag: 'agenda' })
    expect(branch).toBe(`${PLAN_BRANCH_PREFIX}-agenda`)
    expect(PLAN_BRANCH_PREFIX).not.toMatch(/^[A-Z][A-Za-z0-9]*-/)
    const env = worktreeEnvironment({ branch, code: null })
    expect(env.slot).toBe(hashSlotOf(branch))
    expect(numericSlotOfCode('')).toBeNull()
    expect(env).toEqual(worktreeEnvironment({ branch, code: null }))
    const bumped = worktreeEnvironment({ branch, code: null, takenSlots: new Set([env.slot]) })
    expect(bumped.slot).toBe(env.slot + 1)
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

describe('worktreeEnvFileContents (dev/test env parity)', () => {
  const env = worktreeEnvironment({ branch: 'C15-fullcalendar', code: 'C15' })
  const lines = worktreeEnvFileContents({
    branch: 'C15-fullcalendar',
    issueLabel: ' · issue #390',
    generatedBy: 'gerado por pnpm worktree next',
    env,
    payloadSecret: 'secret',
    copiedLines: ['BLOB_READ_WRITE_TOKEN=blob', 'VAPID_PRIVATE_KEY=key'],
  })
  const dev = lines.dev.join('\n')
  const test = lines.test.join('\n')
  const url = `http://localhost:${devPortForSlot(env.slot)}`

  it('the test env carries PLAYWRIGHT_BASE_URL on the slot port (e2e never falls back to 3000)', () => {
    expect(test).toContain(`PLAYWRIGHT_BASE_URL=${url}`)
  })

  it('keeps NEXT_PUBLIC_SITE_URL and PLAYWRIGHT_BASE_URL in parity across both files', () => {
    for (const key of ['NEXT_PUBLIC_SITE_URL', 'PLAYWRIGHT_BASE_URL']) {
      const devValue = dev.split('\n').find((line) => line.startsWith(`${key}=`))
      const testValue = test.split('\n').find((line) => line.startsWith(`${key}=`))
      expect(devValue).toBe(`${key}=${url}`)
      expect(testValue).toBe(devValue)
    }
  })

  it('points each file at its own database and keeps dev-only fields in the dev file', () => {
    expect(dev).toContain(
      `DATABASE_URL=postgresql://teqo:teqo@localhost:5432/${devDatabaseForSlot(env.slot)}`,
    )
    expect(test).toContain(
      `DATABASE_URL=postgresql://teqo:teqo@localhost:5432/${testDatabaseForSlot(env.slot)}`,
    )
    expect(dev).toContain(`PORT=${devPortForSlot(env.slot)}`)
    expect(dev).toContain('PAYLOAD_SECRET=secret')
    expect(dev).toContain('BLOB_READ_WRITE_TOKEN=blob')
    expect(dev).toContain('VAPID_PRIVATE_KEY=key')
    expect(test).not.toContain('PAYLOAD_SECRET')
    expect(test).not.toContain('PORT=')
    expect(test).not.toContain('BLOB_READ_WRITE_TOKEN')
    expect(test).not.toContain('VAPID_PRIVATE_KEY')
  })

  it('both files carry the generated marker and the same header', () => {
    for (const content of [dev, test]) {
      expect(content).toContain(GENERATED_ENV_MARKER)
      expect(content).toContain('branch C15-fullcalendar')
      expect(content).toContain(`· slot ${env.slot}`)
    }
  })
})
