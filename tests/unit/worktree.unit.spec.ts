// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  devDatabaseForSlot,
  devPortForSlot,
  GENERATED_ENV_MARKER,
  hashSlotOf,
  isGeneratedDatabaseName,
  mirroredEnvCopiedLines,
  numericSlotOfCode,
  s3EnvCopiedLines,
  testDatabaseForSlot,
  worktreeEnvFileContents,
  worktreeEnvironment,
} from '../../scripts/lib/worktree-env.mjs'
import {
  assertSkillAutoSupported,
  branchNameForIssue,
  FIX_BRANCH_PREFIX,
  fixBranchName,
  headlessDirective,
  issueCodeAndSubject,
  namespaceLaunchDescriptor,
  OPENCODE_HEADLESS_COMMAND,
  OPENCODE_PRESET_MODEL,
  opencodeHeadlessArgs,
  opencodeLaunchDirective,
  PLAN_BRANCH_PREFIX,
  planBranchName,
  resolveWorktreeModel,
  validateWorktreeFlags,
  WORK_BRANCH_PREFIX,
  workBranchName,
  WORKTREE_FLAG_ALLOWLIST,
  WORKTREE_MODEL_FLAGS,
  WORKTREE_MODEL_MAP,
  WORKTREE_TERMINAL_ENV,
} from '../../scripts/lib/worktree.mjs'

type TestIssue = {
  number: number
  title: string
  meta?: { id?: string }
}

/**
 * Valor esperado do preset no ambiente corrente: o fallback comum quando
 * OPENCODE_WORKTREE_MODEL não está exportado (CI), ou o valor exportado
 * (shell local) — o lib resolve exatamente nessa precedência.
 */
const presetInEffect = () => process.env.OPENCODE_WORKTREE_MODEL || 'deepseek/deepseek-flash'

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

describe('opencodeLaunchDirective (terminal-only agent-session launch, OPS26 + OPS33 + OPS93 + OPS95 + OPS110)', () => {
  const dir = '/home/fsolla/.cursor/worktrees/teqo/OPS26-foo'

  it('returns null outside the terminal — the /worktree command never launches a TUI', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'next' })).toBeNull()
    expect(opencodeLaunchDirective({ dir, purpose: 'plan', terminal: false })).toBeNull()
    expect(
      opencodeLaunchDirective({ dir, purpose: 'next', terminal: false, issueNumber: 595 }),
    ).toBeNull()
  })

  it('next delegates to scripts/agent-session.mjs start with the preset model (no local TUI)', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'next', terminal: true })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=next --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('uses the explicit sessionScript (absolute) — worktrees sem o arquivo novo ainda lançam', () => {
    expect(
      opencodeLaunchDirective({
        dir,
        purpose: 'plan',
        terminal: true,
        sessionScript: '/repo/scripts/agent-session.mjs',
      }),
    ).toBe(
      `launch node /repo/scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('next with an issueNumber carries --issue=<N> (the claimed issue)', () => {
    expect(
      opencodeLaunchDirective({ dir, purpose: 'next', terminal: true, issueNumber: 595 }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=next --dir=${dir} --model=${presetInEffect()} --issue=595`,
    )
  })

  it('plan without a bag launches session-only — the human types /plan-issue', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('new launches session-only — "apenas conversar", no driver/skill', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'new', terminal: true })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=new --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('plan/new ignore the issueNumber — only next carries the claimed issue', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true, issueNumber: 7 })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()}`,
    )
    expect(opencodeLaunchDirective({ dir, purpose: 'new', terminal: true, issueNumber: 7 })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=new --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('fix carries the bag as --argument (quoted value, xargs-safe)', () => {
    expect(
      opencodeLaunchDirective({
        dir,
        purpose: 'fix',
        terminal: true,
        argument: '500 no autosave de estimativas',
      }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=fix --dir=${dir} --model=${presetInEffect()} --argument="500 no autosave de estimativas"`,
    )
  })

  it('fix without a bag omits --argument', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'fix', terminal: true })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=fix --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('fix strips quotes/backslashes from the bag (xargs-safe) and drops it when it empties', () => {
    expect(
      opencodeLaunchDirective({ dir, purpose: 'fix', terminal: true, argument: 'a"b\\c bug' }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=fix --dir=${dir} --model=${presetInEffect()} --argument="abc bug"`,
    )
    expect(opencodeLaunchDirective({ dir, purpose: 'fix', terminal: true, argument: ' "" ' })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=fix --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('fix ignores the issueNumber — fix worktrees never carry a claimed issue', () => {
    expect(
      opencodeLaunchDirective({
        dir,
        purpose: 'fix',
        terminal: true,
        issueNumber: 7,
        argument: 'bug x',
      }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=fix --dir=${dir} --model=${presetInEffect()} --argument="bug x"`,
    )
  })

  it('the argument belongs to fix and plan — new ignores it', () => {
    expect(
      opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true, argument: 'bag x' }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()} --argument="bag x"`,
    )
    expect(
      opencodeLaunchDirective({ dir, purpose: 'new', terminal: true, argument: 'bag x' }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=new --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('plan strips quotes/backslashes from the bag and drops --argument when it empties', () => {
    expect(
      opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true, argument: 'a"b\\c ideia' }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()} --argument="abc ideia"`,
    )
    expect(
      opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true, argument: ' "" ' }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('pins the preset constants — fallback comum deepseek-flash, override via OPENCODE_WORKTREE_MODEL', () => {
    expect(OPENCODE_PRESET_MODEL).toBe(presetInEffect())
    expect(WORKTREE_TERMINAL_ENV).toBe('TEQO_WORKTREE_TERMINAL')
  })

  it('an unknown purpose still delegates — the session CLI decides there is no command (fail-safe)', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'bogus', terminal: true })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=bogus --dir=${dir} --model=${presetInEffect()}`,
    )
  })

  it('never emits --variant in the directive — the TUI yargs rejects it (OPS95); the variant rides the session body/driver (OPS127)', () => {
    for (const model of Object.values(WORKTREE_MODEL_MAP)) {
      for (const purpose of ['next', 'plan', 'new']) {
        const directive = opencodeLaunchDirective({ dir, purpose, terminal: true, model })
        expect(directive).not.toContain('--variant')
      }
    }
  })

  it('uses the explicit model when provided (OPS93 map, OPS95 values)', () => {
    for (const [, model] of Object.entries(WORKTREE_MODEL_MAP)) {
      expect(opencodeLaunchDirective({ dir, purpose: 'next', terminal: true, model })).toBe(
        `launch node scripts/agent-session.mjs start --purpose=next --dir=${dir} --model=${model}`,
      )
    }
  })

  it('explicit model ignored outside the terminal — still null', () => {
    expect(
      opencodeLaunchDirective({
        dir,
        purpose: 'next',
        terminal: false,
        model: WORKTREE_MODEL_MAP.cheap,
      }),
    ).toBeNull()
  })

  it('skillAuto carries --skill-auto to the session CLI (OPS122 — o --auto do humano)', () => {
    expect(
      opencodeLaunchDirective({
        dir,
        purpose: 'next',
        terminal: true,
        issueNumber: 1088,
        skillAuto: true,
      }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=next --dir=${dir} --model=${presetInEffect()} --skill-auto --issue=1088`,
    )
    expect(opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true, skillAuto: true })).toBe(
      `launch node scripts/agent-session.mjs start --purpose=plan --dir=${dir} --model=${presetInEffect()} --skill-auto`,
    )
    expect(
      opencodeLaunchDirective({
        dir,
        purpose: 'fix',
        terminal: true,
        skillAuto: true,
        argument: 'bug x',
      }),
    ).toBe(
      `launch node scripts/agent-session.mjs start --purpose=fix --dir=${dir} --model=${presetInEffect()} --skill-auto --argument="bug x"`,
    )
  })

  it('omits --skill-auto by default and outside the terminal (supervised stays byte-identical)', () => {
    expect(opencodeLaunchDirective({ dir, purpose: 'next', terminal: true })).not.toContain(
      '--skill-auto',
    )
    expect(
      opencodeLaunchDirective({ dir, purpose: 'next', terminal: false, skillAuto: true }),
    ).toBeNull()
  })
})

describe('namespaceLaunchDescriptor (purpose→options single source, OPS119+)', () => {
  it('plan carries the bag as argument and labels the session with it', () => {
    expect(namespaceLaunchDescriptor({ purpose: 'plan', bag: 'revisa o gate' })).toEqual({
      noun: 'de planejamento',
      sessionLabel: 'lote "revisa o gate"',
      argument: 'revisa o gate',
    })
  })

  it('plan without a bag is driverless: sequential label, no argument', () => {
    expect(namespaceLaunchDescriptor({ purpose: 'plan' })).toEqual({
      noun: 'de planejamento',
      sessionLabel: 'sequencial',
      argument: null,
    })
  })

  it('a blank bag is labeled sequential (trim decides the label) but still rides raw', () => {
    expect(namespaceLaunchDescriptor({ purpose: 'plan', bag: '   ' })).toEqual({
      noun: 'de planejamento',
      sessionLabel: 'sequencial',
      argument: '   ',
    })
  })

  it('does not sanitize the bag — quotes/backslashes ride raw (sanitization stays with the owners)', () => {
    const descriptor = namespaceLaunchDescriptor({ purpose: 'plan', bag: 'a "b"\\c ideia' })
    expect(descriptor.argument).toBe('a "b"\\c ideia')
    expect(descriptor.sessionLabel).toBe('lote "a "b"\\c ideia"')
  })

  it('new is neutral: it never carries an argument, even with a bag', () => {
    expect(namespaceLaunchDescriptor({ purpose: 'new' })).toEqual({
      noun: 'neutro',
      sessionLabel: 'sequencial',
      argument: null,
    })
    expect(namespaceLaunchDescriptor({ purpose: 'new', bag: 'ideia solta' })).toEqual({
      noun: 'neutro',
      sessionLabel: 'bag "ideia solta"',
      argument: null,
    })
  })

  it('fix carries the bug description and labels it', () => {
    expect(namespaceLaunchDescriptor({ purpose: 'fix', bag: '500 no autosave' })).toEqual({
      noun: 'de correção de bug',
      sessionLabel: 'bug "500 no autosave"',
      argument: '500 no autosave',
    })
    expect(namespaceLaunchDescriptor({ purpose: 'fix' })).toEqual({
      noun: 'de correção de bug',
      sessionLabel: 'sequencial',
      argument: null,
    })
  })

  it('throws on an unknown/absent purpose — a purpose without a descriptor is a wiring error', () => {
    for (const purpose of [null, undefined, 'next', 'bogus', 'constructor']) {
      expect(() => namespaceLaunchDescriptor({ purpose })).toThrow(/purpose desconhecido/)
    }
  })
})

describe('opencodeHeadlessArgs + headlessDirective (OPS106 auto-unblock)', () => {
  it('builds the opencode run argv with the bug-fix command and the report as one arg', () => {
    expect(
      opencodeHeadlessArgs({ model: 'deepseek/deepseek-flash', report: 'run 1 falhou' }),
    ).toEqual([
      'opencode',
      'run',
      '--model',
      'deepseek/deepseek-flash',
      '--variant',
      'max',
      '--auto',
      '--command',
      OPENCODE_HEADLESS_COMMAND,
      'run 1 falhou',
    ])
  })

  it('defaults the command to bug-fix and allows an override', () => {
    expect(OPENCODE_HEADLESS_COMMAND).toBe('bug-fix')
    expect(opencodeHeadlessArgs({ model: 'm', report: 'r', command: 'x' })).toContain('x')
  })

  it('fails high on a missing model or empty report', () => {
    expect(() => opencodeHeadlessArgs({ model: '', report: 'r' })).toThrow(/model/)
    expect(() => opencodeHeadlessArgs({ model: 'm', report: '   ' })).toThrow(/report/)
  })

  it('headlessDirective carries dir/branch/model and the argv', () => {
    const directive = headlessDirective({
      dir: '/work/fix/abc',
      branch: 'fix/abc',
      model: 'deepseek/deepseek-flash',
      report: 'r',
    })
    expect(directive.dir).toBe('/work/fix/abc')
    expect(directive.branch).toBe('fix/abc')
    expect(directive.argv[0]).toBe('opencode')
    expect(() => headlessDirective({ model: 'm', report: 'r' })).toThrow(/dir/)
  })
})

describe('resolveWorktreeModel + WORKTREE_MODEL_MAP (OPS93 menu, OPS95 values, OPS100 glm/free, OPS112 go/zen, OPS129 zen/free)', () => {
  it('pins the 7-flag map — cheap/pro/zen/go/alibaba/glm/free', () => {
    expect(WORKTREE_MODEL_MAP).toEqual({
      cheap: 'cheapestinference/deepseek-v4-flash',
      pro: 'deepseek/deepseek-v4-pro',
      zen: 'opencode/space-bunny-free',
      go: 'opencode-go/deepseek-v4.1-flash',
      alibaba: 'alibaba-token-plan/deepseek-v4-flash',
      glm: 'opencode-go/glm-5.3-flash',
      free: 'openrouter/stealth/space-bunny-alpha',
    })
    expect(WORKTREE_MODEL_FLAGS).toEqual(
      new Set(['cheap', 'pro', 'zen', 'go', 'alibaba', 'glm', 'free']),
    )
  })

  it('no flag → preset', () => {
    expect(resolveWorktreeModel({})).toBe(presetInEffect())
    expect(resolveWorktreeModel({ stay: true })).toBe(presetInEffect())
    expect(resolveWorktreeModel({ issue: '123' })).toBe(presetInEffect())
  })

  it('single flag → mapped model', () => {
    expect(resolveWorktreeModel({ cheap: true })).toBe(WORKTREE_MODEL_MAP.cheap)
    expect(resolveWorktreeModel({ pro: true })).toBe(WORKTREE_MODEL_MAP.pro)
    expect(resolveWorktreeModel({ zen: true })).toBe(WORKTREE_MODEL_MAP.zen)
    expect(resolveWorktreeModel({ go: true })).toBe(WORKTREE_MODEL_MAP.go)
    expect(resolveWorktreeModel({ alibaba: true })).toBe(WORKTREE_MODEL_MAP.alibaba)
    expect(resolveWorktreeModel({ glm: true })).toBe(WORKTREE_MODEL_MAP.glm)
    expect(resolveWorktreeModel({ free: true })).toBe(WORKTREE_MODEL_MAP.free)
  })

  it('multiple flags → throws (fail-high, never guess)', () => {
    expect(() => resolveWorktreeModel({ cheap: true, pro: true })).toThrow(/conflitantes/)
    expect(() => resolveWorktreeModel({ zen: true, go: true })).toThrow(/--zen --go/)
    expect(() => resolveWorktreeModel({ cheap: true, alibaba: true, go: true })).toThrow(
      /conflitantes/,
    )
  })

  it('each flag launches with the mapped model in the directive (next/plan/new share the path)', () => {
    const dir = '/tmp/wt'
    for (const [flag, model] of Object.entries(WORKTREE_MODEL_MAP)) {
      const resolved = resolveWorktreeModel({ [flag]: true })
      expect(resolved).toBe(model)
      expect(
        opencodeLaunchDirective({ dir, purpose: 'next', terminal: true, model: resolved }),
      ).toContain(`--model=${model}`)
      expect(
        opencodeLaunchDirective({ dir, purpose: 'plan', terminal: true, model: resolved }),
      ).toContain(`--model=${model}`)
      expect(
        opencodeLaunchDirective({ dir, purpose: 'new', terminal: true, model: resolved }),
      ).toContain(`--model=${model}`)
    }
  })
})

describe('validateWorktreeFlags + WORKTREE_FLAG_ALLOWLIST (OPS122 — flag desconhecida falha alto)', () => {
  it('pins the accepted names per verb (model flags included)', () => {
    const modelFlags = [...WORKTREE_MODEL_FLAGS]
    expect(WORKTREE_FLAG_ALLOWLIST).toEqual({
      next: ['issue', 'stay', 'no-migrate', 'auto', ...modelFlags],
      plan: ['stay', 'no-migrate', 'auto', ...modelFlags],
      new: ['stay', 'no-migrate', 'auto', ...modelFlags],
      fix: ['stay', 'no-migrate', 'headless', 'directive', 'auto', ...modelFlags],
      kill: ['force', 'stay'],
    })
  })

  it('accepts every documented flag per verb', () => {
    expect(() =>
      validateWorktreeFlags({
        subcommand: 'next',
        flags: { issue: '1088', stay: true, 'no-migrate': true, auto: true, zen: true },
      }),
    ).not.toThrow()
    expect(() =>
      validateWorktreeFlags({ subcommand: 'plan', flags: { auto: true, go: true } }),
    ).not.toThrow()
    expect(() =>
      validateWorktreeFlags({
        subcommand: 'fix',
        flags: { headless: true, directive: '/d', auto: true, free: true },
      }),
    ).not.toThrow()
    expect(() =>
      validateWorktreeFlags({ subcommand: 'kill', flags: { force: true } }),
    ).not.toThrow()
  })

  it('suggests the neighbor: --zen flag typo and --stay typo', () => {
    expect(() => validateWorktreeFlags({ subcommand: 'next', flags: { zenm: true } })).toThrow(
      /--zenm[\s\S]*--zen/,
    )
    expect(() => validateWorktreeFlags({ subcommand: 'plan', flags: { stya: true } })).toThrow(
      /--stya[\s\S]*--stay/,
    )
  })

  it('reports an unknown flag without a suggestion as-is', () => {
    expect(() =>
      validateWorktreeFlags({ subcommand: 'next', flags: { totallyWrong: true } }),
    ).toThrow('flag desconhecida: --totallyWrong.')
  })

  it('rejects a flag that belongs to another verb', () => {
    expect(() => validateWorktreeFlags({ subcommand: 'plan', flags: { issue: '1' } })).toThrow(
      /--issue/,
    )
    expect(() => validateWorktreeFlags({ subcommand: 'next', flags: { headless: true } })).toThrow(
      /--headless/,
    )
    expect(() => validateWorktreeFlags({ subcommand: 'kill', flags: { auto: true } })).toThrow(
      /--auto/,
    )
  })

  it('ignores a bare `--` and stays silent for an unknown/absent verb', () => {
    expect(() =>
      validateWorktreeFlags({ subcommand: 'next', flags: { '': true, stay: true } }),
    ).not.toThrow()
    expect(() =>
      validateWorktreeFlags({ subcommand: 'bogus', flags: { whatever: true } }),
    ).not.toThrow()
    expect(() =>
      validateWorktreeFlags({ subcommand: null, flags: { whatever: true } }),
    ).not.toThrow()
  })
})

describe('assertSkillAutoSupported (OPS122 — `--auto` não-honrável falha alto)', () => {
  it('honors next always and fix/plan only with a bag', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'next' })).not.toThrow()
    expect(() => assertSkillAutoSupported({ purpose: 'fix', bag: 'bug' })).not.toThrow()
    expect(() => assertSkillAutoSupported({ purpose: 'plan', bag: 'uma ideia' })).not.toThrow()
  })

  it('fails high on new (neutral session, no skill to auto-submit)', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'new' })).toThrow(/new|neutra/)
    expect(() => assertSkillAutoSupported({ purpose: 'new', bag: 'ideia' })).toThrow(/new|neutra/)
  })

  it('fails high on plan without a bag (OPS119 keeps it driverless)', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'plan' })).toThrow(/bag|driverless|sem/)
    expect(() => assertSkillAutoSupported({ purpose: 'plan', bag: '   ' })).toThrow(
      /bag|driverless|sem/,
    )
  })

  it('fails high on --stay (the launch is suppressed, so --auto would be dead)', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'next', stay: true })).toThrow(/--stay/)
  })

  it('fails high on --headless (the auto-unblock path has no skill invocation)', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'fix', bag: 'bug', headless: true })).toThrow(
      /--headless/,
    )
  })

  it('fails high outside the interactive terminal (the /worktree command never launches)', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'next', terminal: false })).toThrow(/terminal/)
    expect(() => assertSkillAutoSupported({ purpose: 'plan', bag: 'x', terminal: false })).toThrow(
      /terminal/,
    )
  })

  it('fails high on an unknown purpose (never invents a command)', () => {
    expect(() => assertSkillAutoSupported({ purpose: 'bogus' })).toThrow(/bogus/)
    expect(() => assertSkillAutoSupported({})).toThrow()
  })
})

describe('workBranchName (per-invocation neutral worktrees)', () => {
  it('no bag → first free sequential work/<n>', () => {
    expect(workBranchName({})).toBe('work/1')
    expect(workBranchName({ bag: '' })).toBe('work/1')
    expect(workBranchName({ bag: '   ' })).toBe('work/1')
  })

  it('no bag → skips taken sequential names (parallel sessions)', () => {
    const taken = new Set(['work/1', 'work/2'])
    expect(workBranchName({ taken })).toBe('work/3')
  })

  it('named bag → work/<slug> when free', () => {
    expect(workBranchName({ bag: 'Ideia solta' })).toBe('work/ideia-solta')
  })

  it('named bag whose name is taken → suffixed -2, -3, …', () => {
    const taken = new Set(['work/ideia'])
    expect(workBranchName({ bag: 'ideia', taken })).toBe('work/ideia-2')

    taken.add('work/ideia-2')
    expect(workBranchName({ bag: 'ideia', taken })).toBe('work/ideia-3')
  })

  it('each invocation returns a different branch for the same bag (live name)', () => {
    const first = workBranchName({ bag: 'teste' })
    expect(workBranchName({ bag: 'teste', taken: new Set([first]) })).toBe('work/teste-2')
  })

  it('never collides with a `next` branch nor with a `plan` branch', () => {
    const taken = new Set(['C15-fullcalendar-em-campanha-agenda', 'plans/plan-issue-agenda'])
    expect(WORK_BRANCH_PREFIX).toBe('work')
    expect(`${WORK_BRANCH_PREFIX}/`).not.toMatch(/^[A-Z][A-Za-z0-9]*-/)
    for (const bag of ['agenda', 'municipios', 'C15']) {
      const branch = workBranchName({ bag, taken })
      expect(branch).toMatch(/^work\//)
      expect(branch).not.toMatch(/^[A-Z][A-Za-z0-9]*-/)
      expect(branch).not.toMatch(/^plans\//)
    }
  })

  it('a numeric bag shares the sequential namespace (uniform)', () => {
    expect(workBranchName({ bag: '3' })).toBe('work/3')
  })

  it('unslugifiable bag falls back to the namespace label', () => {
    expect(workBranchName({ bag: '!!!' })).toBe('work/work')
  })

  it('truncates long slugs within the branch budget', () => {
    const branch = workBranchName({ bag: 'palavra '.repeat(20).trim() })
    expect(branch.startsWith('work/')).toBe(true)
    expect(branch.length).toBeLessThanOrEqual(60)
    expect(branch).toBe(`work/${'palavra-'.repeat(6)}palavra`)
  })

  it('keeps the -2 suffix inside the branch budget when the base is taken', () => {
    const bag = 'palavra '.repeat(20).trim()
    const base = workBranchName({ bag })
    expect(base.length).toBe(60)
    const suffixed = workBranchName({ bag, taken: new Set([base]) })
    expect(suffixed.length).toBe(60)
    expect(suffixed.endsWith('-2')).toBe(true)
    expect(suffixed).toBe(`work/${'palavra-'.repeat(6)}palav-2`)
  })

  it('planBranchName keeps its own namespace contract untouched', () => {
    expect(planBranchName({})).toBe('plans/plan-issue-1')
    expect(planBranchName({ bag: 'agenda', taken: new Set(['plans/plan-issue-agenda']) })).toBe(
      'plans/plan-issue-agenda-2',
    )
  })
})

describe('fixBranchName (per-invocation bug-fix worktrees)', () => {
  it('no bag → first free sequential fix/<n>', () => {
    expect(fixBranchName({})).toBe('fix/1')
    expect(fixBranchName({ bag: '' })).toBe('fix/1')
    expect(fixBranchName({ bag: '   ' })).toBe('fix/1')
  })

  it('no bag → skips taken sequential names (parallel sessions)', () => {
    const taken = new Set(['fix/1', 'fix/2'])
    expect(fixBranchName({ taken })).toBe('fix/3')
  })

  it('named bag → fix/<slug> when free (the bug description slugs the branch)', () => {
    expect(fixBranchName({ bag: '500 no autosave de estimativas' })).toBe(
      'fix/500-no-autosave-de-estimativas',
    )
  })

  it('named bag whose name is taken → suffixed -2, -3, …', () => {
    const taken = new Set(['fix/bug'])
    expect(fixBranchName({ bag: 'bug', taken })).toBe('fix/bug-2')

    taken.add('fix/bug-2')
    expect(fixBranchName({ bag: 'bug', taken })).toBe('fix/bug-3')
  })

  it('each invocation returns a different branch for the same bag (live name)', () => {
    const first = fixBranchName({ bag: 'teste' })
    expect(fixBranchName({ bag: 'teste', taken: new Set([first]) })).toBe('fix/teste-2')
  })

  it('never collides with a `next` branch nor with a `plan` nor with a `new` branch', () => {
    const taken = new Set([
      'C15-fullcalendar-em-campanha-agenda',
      'plans/plan-issue-agenda',
      'work/agenda',
    ])
    expect(FIX_BRANCH_PREFIX).toBe('fix')
    expect(`${FIX_BRANCH_PREFIX}/`).not.toMatch(/^[A-Z][A-Za-z0-9]*-/)
    for (const bag of ['agenda', 'municipios', 'C15']) {
      const branch = fixBranchName({ bag, taken })
      expect(branch).toMatch(/^fix\//)
      expect(branch).not.toMatch(/^[A-Z][A-Za-z0-9]*-/)
      expect(branch).not.toMatch(/^plans\//)
      expect(branch).not.toMatch(/^work\//)
    }
  })

  it('a numeric bag shares the sequential namespace (uniform)', () => {
    expect(fixBranchName({ bag: '3' })).toBe('fix/3')
  })

  it('unslugifiable bag falls back to the namespace label', () => {
    expect(fixBranchName({ bag: '!!!' })).toBe('fix/fix')
  })

  it('truncates long slugs within the branch budget', () => {
    const branch = fixBranchName({ bag: 'palavra '.repeat(20).trim() })
    expect(branch.startsWith('fix/')).toBe(true)
    expect(branch.length).toBeLessThanOrEqual(60)
    // fix/ leaves a 56-char slug budget — 7 exact 8-char "palavra-" chunks.
    expect(branch).toBe(`fix/${'palavra-'.repeat(7)}`)
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

describe('s3EnvCopiedLines (OPS52 media storage, all-or-nothing)', () => {
  const full = () => ({
    S3_BUCKET: 'teqo-media',
    S3_ENDPOINT: 'http://100.119.220.31:3900',
    S3_ACCESS_KEY_ID: 'AK-test',
    S3_SECRET_ACCESS_KEY: 'secret',
  })

  it('copies all five S3_* lines when the four required keys are present', () => {
    expect(s3EnvCopiedLines({ ...full(), S3_REGION: 'garage' })).toEqual([
      'S3_BUCKET=teqo-media',
      'S3_ENDPOINT=http://100.119.220.31:3900',
      'S3_ACCESS_KEY_ID=AK-test',
      'S3_SECRET_ACCESS_KEY=secret',
      'S3_REGION=garage',
    ])
  })

  it('copies nothing when no S3_* key is set (local storage fallback)', () => {
    expect(s3EnvCopiedLines({ DATABASE_URL: 'x' })).toEqual([])
  })

  it('copies nothing on a partial set — a partial config would abort the boot', () => {
    const partial: Record<string, string> = { ...full() }
    delete partial.S3_SECRET_ACCESS_KEY
    expect(s3EnvCopiedLines(partial)).toEqual([])
    expect(s3EnvCopiedLines({ ...full(), S3_BUCKET: '' })).toEqual([])
  })
})

describe('mirroredEnvCopiedLines (optional envs mirrored into the worktree)', () => {
  it('copies PORTAL_TRANSPARENCIA_API_KEY from the main env (C163/C190 reports)', () => {
    expect(mirroredEnvCopiedLines({ PORTAL_TRANSPARENCIA_API_KEY: 'eb32-key' })).toEqual([
      'PORTAL_TRANSPARENCIA_API_KEY=eb32-key',
    ])
  })

  it('copies every mirrored key present, in a stable order, skipping absent ones', () => {
    expect(
      mirroredEnvCopiedLines({
        RESEND_API_KEY: 're_1',
        VAPID_PRIVATE_KEY: 'priv',
        PORTAL_TRANSPARENCIA_API_KEY: 'eb32-key',
      }),
    ).toEqual([
      'VAPID_PRIVATE_KEY=priv',
      'RESEND_API_KEY=re_1',
      'PORTAL_TRANSPARENCIA_API_KEY=eb32-key',
    ])
  })

  it('copies nothing when no mirrored key is set', () => {
    expect(mirroredEnvCopiedLines({ DATABASE_URL: 'x' })).toEqual([])
    expect(mirroredEnvCopiedLines({ PORTAL_TRANSPARENCIA_API_KEY: '' })).toEqual([])
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
    copiedLines: [
      'S3_BUCKET=teqo-media',
      'S3_ENDPOINT=http://100.119.220.31:3900',
      'VAPID_PRIVATE_KEY=key',
    ],
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
    expect(dev).toContain('S3_BUCKET=teqo-media')
    expect(dev).toContain('S3_ENDPOINT=http://100.119.220.31:3900')
    expect(dev).toContain('VAPID_PRIVATE_KEY=key')
    expect(test).not.toContain('PAYLOAD_SECRET')
    expect(test).not.toContain('PORT=')
    expect(test).not.toContain('S3_BUCKET')
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
