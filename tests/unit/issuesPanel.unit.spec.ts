// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildIssueRow,
  buildPanelViewModel,
  classifyPlanStatus,
  filterByState,
  filterCounts,
  issueAction,
  issueCode,
  issueDepends,
  issueState,
  issueSummary,
  parsePlanStatus,
  planLabel,
  resolveUiDraft,
  siblingPlanPaths,
  sortRows,
  toJsonPayload,
} from '../../scripts/lib/issues-panel.mjs'

const issue = (over: Record<string, unknown> = {}) => ({
  number: 1020,
  title: 'OPS109 — Painel de issues e planos no terminal (via SSH)',
  body: [
    '---',
    'id: OPS109',
    'depends: [OPS110]',
    'priority: P2',
    '---',
    'Plano: [`docs/plans/ops109-painel-issues-no-terminal.md`](docs/plans/ops109-painel-issues-no-terminal.md)',
    '',
    'Ferramenta local para visualizar o andamento.',
  ].join('\n'),
  state: 'OPEN',
  createdAt: '2026-09-15T10:00:00.000Z',
  labels: [
    { name: 'in-progress', color: '' },
    { name: 'prio:P2', color: '' },
    { name: 'kind:feature', color: '' },
  ],
  ...over,
})

describe('parsePlanStatus (OPS109)', () => {
  it('reads the raw and normalized Status line', () => {
    expect(parsePlanStatus('# T\n\nStatus: aprovado\n')).toEqual({
      raw: 'aprovado',
      normalized: 'aprovado',
    })
  })

  it('strips bold, backticks and parenthetical suffixes', () => {
    expect(parsePlanStatus('Status: **entregue** (2026-07-29)')?.raw).toBe('entregue (2026-07-29)')
    expect(parsePlanStatus('Status: `aprovado (gate humano 2026-09-10)`')?.raw).toBe(
      'aprovado (gate humano 2026-09-10)',
    )
  })

  it('returns null when there is no Status line', () => {
    expect(parsePlanStatus('# só título')).toBeNull()
    expect(parsePlanStatus('')).toBeNull()
  })
})

describe('classifyPlanStatus (OPS109 — leitura de produto)', () => {
  it.each([
    ['aprovado', 'aprovado'],
    ['aprovado (gate humano 2026-09-10)', 'aprovado'],
    ['rascunho', 'aguardando'],
    ['registrado', 'aguardando'],
    ['blocked', 'aguardando'],
    ['em execução', 'andou'],
    ['executado', 'andou'],
    ['entregue', 'andou'],
    ['entregue (2026-07-29)', 'andou'],
    ['plano — registrado (blocked até plano em main)', 'aguardando'],
    ['qualquer coisa nova', 'desconhecido'],
  ])('%s → %s', (raw, expected) => {
    expect(classifyPlanStatus({ raw, normalized: raw.toLowerCase() })).toBe(expected)
  })

  it('fails safe to desconhecido when there is no status', () => {
    expect(classifyPlanStatus(null)).toBe('desconhecido')
    expect(classifyPlanStatus({ raw: '', normalized: '' })).toBe('desconhecido')
  })
})

describe('siblingPlanPaths (OPS109 / OPS116)', () => {
  it('derives impl, ui-design and the legacy ui-draft from the intent path', () => {
    expect(siblingPlanPaths('docs/plans/ops109-x.md')).toEqual({
      impl: 'docs/plans/ops109-x-impl.md',
      uiDesign: 'docs/plans/ops109-x-ui-design.html',
      uiDraft: 'docs/plans/ops109-x-ui-draft.html',
    })
  })

  it('does not double-suffix when given the impl path', () => {
    expect(siblingPlanPaths('docs/plans/ops109-x-impl.md').impl).toBe('docs/plans/ops109-x-impl.md')
  })

  it('returns nulls for a non-markdown path', () => {
    expect(siblingPlanPaths(null)).toEqual({ impl: null, uiDesign: null, uiDraft: null })
    expect(siblingPlanPaths('docs/plans/x.html')).toEqual({
      impl: null,
      uiDesign: null,
      uiDraft: null,
    })
  })
})

describe('resolveUiDraft (OPS116 — design wins over the legacy draft)', () => {
  const intent = 'docs/plans/ops116-x.md'
  const design = 'docs/plans/ops116-x-ui-design.html'
  const draft = 'docs/plans/ops116-x-ui-draft.html'
  const only =
    (...existing: string[]) =>
    (path: string) =>
      existing.includes(path)

  it('prefers the current -ui-design.html when only it exists', () => {
    expect(resolveUiDraft(intent, only(design))).toEqual({ path: design, exists: true })
  })

  it('falls back to the legacy -ui-draft.html (retrocompat)', () => {
    expect(resolveUiDraft(intent, only(draft))).toEqual({ path: draft, exists: true })
  })

  it('uses the current name when both exist', () => {
    expect(resolveUiDraft(intent, only(design, draft))).toEqual({ path: design, exists: true })
  })

  it('shows the current name with exists:false when neither exists', () => {
    expect(resolveUiDraft(intent, only())).toEqual({ path: design, exists: false })
  })

  it('is pure — defaults to no file on disk', () => {
    expect(resolveUiDraft(intent)).toEqual({ path: design, exists: false })
  })

  it('returns a null path when the plan has no markdown path', () => {
    expect(resolveUiDraft(null, only(draft))).toEqual({ path: null, exists: false })
  })
})

describe('issue field derivation (OPS109)', () => {
  it('reads the frontmatter id and depends', () => {
    expect(issueCode(issue())).toBe('OPS109')
    expect(issueDepends(issue())).toEqual(['OPS110'])
  })

  it('derives state/priority/kind from labels', () => {
    expect(issueState(issue())).toBe('in-progress')
    expect(issueState(issue({ state: 'CLOSED' }))).toBe('done')
    expect(issueState(issue({ labels: [{ name: 'ready', color: '' }] }))).toBe('ready')
  })

  it('summarizes the body after the frontmatter and plan link', () => {
    expect(issueSummary(issue())).toBe('Ferramenta local para visualizar o andamento.')
  })

  it('returns null id and empty depends for an id-less body', () => {
    const bare = issue({ body: 'sem frontmatter' })
    expect(issueCode(bare)).toBeNull()
    expect(issueDepends(bare)).toEqual([])
  })
})

describe('buildIssueRow (OPS109)', () => {
  const deps = {
    doneIds: new Set<string>(),
    knownIds: new Set(['OPS110']),
  }

  it('marks a plan present with the classification', () => {
    const row = buildIssueRow(issue(), {
      ...deps,
      intention: 'Status: aprovado\n',
      impl: 'Status: em execução\n',
    })
    expect(row.plan.intention).toMatchObject({
      path: 'docs/plans/ops109-painel-issues-no-terminal.md',
      exists: true,
      classification: 'aprovado',
    })
    expect(row.plan.impl).toMatchObject({
      path: 'docs/plans/ops109-painel-issues-no-terminal-impl.md',
      exists: true,
      classification: 'andou',
    })
    expect(row.uiDraft).toEqual({
      path: 'docs/plans/ops109-painel-issues-no-terminal-ui-design.html',
      exists: false,
    })
  })

  it('carries the real design path the CLI resolved on disk', () => {
    const row = buildIssueRow(issue(), {
      ...deps,
      uiDraft: { path: 'docs/plans/ops109-painel-issues-no-terminal-ui-draft.html', exists: true },
    })
    expect(row.uiDraft).toEqual({
      path: 'docs/plans/ops109-painel-issues-no-terminal-ui-draft.html',
      exists: true,
    })
  })

  it('returns a null design path when the plan is missing', () => {
    const row = buildIssueRow(issue({ body: '---\nid: OPS999\n---\nsem plano' }), deps)
    expect(row.uiDraft).toEqual({ path: null, exists: false })
  })

  it('derives the same design artifact from an impl plan link', () => {
    const implLinked = issue({
      body: '---\nid: OPS109\n---\nPlano: [`docs/plans/ops109-painel-issues-no-terminal-impl.md`](docs/plans/ops109-painel-issues-no-terminal-impl.md)',
    })
    expect(buildIssueRow(implLinked, deps).uiDraft).toEqual({
      path: 'docs/plans/ops109-painel-issues-no-terminal-ui-design.html',
      exists: false,
    })
  })

  it('explains missing intention and impl as first-class states', () => {
    const row = buildIssueRow(issue(), { ...deps, intention: null, impl: null })
    expect(row.plan.intention).toMatchObject({ exists: false, classification: 'não criado' })
    expect(row.plan.impl).toMatchObject({ exists: false, classification: 'não criado' })
    expect(planLabel({ plan: { intention: null, impl: null } })).toBe('sem plano')
  })

  it('reports sem plano when the body has no plan link', () => {
    const row = buildIssueRow(issue({ body: '---\nid: OPS999\n---\nsem plano' }), deps)
    expect(row.plan.intention.path).toBeNull()
    expect(row.plan.intention.exists).toBe(false)
  })

  it('ties the session by issue number and falls back to none', () => {
    const sessions = [
      { sessionID: 'ses_abc', issue: 1020, branch: 'OPS109-x', dir: '/tmp/x', status: 'working' },
      { sessionID: 'ses_def', issue: 9999, branch: 'OPS999-y', dir: '/tmp/y', status: 'idle' },
    ]
    const withSession = buildIssueRow(issue(), { ...deps, sessions })
    expect(withSession.session).toMatchObject({ status: 'working', sessionID: 'ses_abc' })

    const withoutSession = buildIssueRow(issue({ number: 4242 }), { ...deps, sessions })
    expect(withoutSession.session).toBeNull()
  })
})

describe('issueAction (OPS109)', () => {
  const base = {
    state: 'ready',
    plan: { intention: null, impl: null },
    blockedBy: [],
  }

  it('prefers the blocked dependency reason', () => {
    expect(issueAction({ ...base, blockedBy: ['OPS111'] })).toBe('travada (depends OPS111)')
  })

  it('reads in-progress, waiting, done and ready', () => {
    expect(issueAction({ ...base, state: 'in-progress' })).toBe('em andamento')
    expect(
      issueAction({
        ...base,
        plan: { intention: { classification: 'aguardando' }, impl: null },
      }),
    ).toBe('aguardando aprovação')
    expect(issueAction({ ...base, state: 'done' })).toBe('concluída')
    expect(issueAction({ ...base, state: 'ready' })).toBe('pronta')
  })

  it('does not treat em execução as waiting', () => {
    expect(
      issueAction({
        ...base,
        state: 'blocked',
        plan: { intention: { classification: 'andou' }, impl: { classification: 'andou' } },
      }),
    ).toBe('travada')
  })
})

describe('filterByState / sortRows / filterCounts (OPS109)', () => {
  const rows: { number: number; code: string; state: string; priority: string; action: string }[] =
    [
      { number: 1, code: 'A', state: 'in-progress', priority: 'P1', action: 'em andamento' },
      { number: 2, code: 'B', state: 'ready', priority: 'P0', action: 'aguardando aprovação' },
      { number: 3, code: 'C', state: 'done', priority: 'P2', action: 'concluída' },
      { number: 4, code: 'D', state: 'blocked', priority: 'P2', action: 'travada' },
    ]

  it('filters by the four keys and fails open on unknown', () => {
    expect(filterByState(rows, 'all').length).toBe(4)
    expect(filterByState(rows, 'in-progress').map((row) => row.number)).toEqual([1])
    expect(filterByState(rows, 'waiting').map((row) => row.number)).toEqual([2])
    expect(filterByState(rows, 'done').map((row) => row.number)).toEqual([3])
    expect(filterByState(rows, 'nonsense').length).toBe(4)
  })

  it('counts each band', () => {
    expect(filterCounts(rows)).toEqual({ all: 4, 'in-progress': 1, waiting: 1, done: 1 })
  })

  it('orders open work before blocked before done', () => {
    expect(sortRows(rows).map((row) => row.number)).toEqual([1, 2, 4, 3])
  })
})

describe('buildPanelViewModel / toJsonPayload (OPS109)', () => {
  const issues = [
    issue(),
    issue({
      number: 1019,
      state: 'CLOSED',
      labels: [
        { name: 'done', color: '' },
        { name: 'in-prod', color: '' },
        { name: 'prio:P2', color: '' },
      ],
      body: '---\nid: OPS110\n---\nPlano: [`docs/plans/ops110.md`](docs/plans/ops110.md)',
    }),
  ]
  const plansByNumber = new Map([
    [
      1020,
      {
        intention: 'Status: aprovado\n',
        impl: 'Status: em execução\n',
        uiDraft: {
          path: 'docs/plans/ops109-painel-issues-no-terminal-ui-design.html',
          exists: true,
        },
      },
    ],
  ])

  it('assembles rows, counts and the truncation flag', () => {
    const model = buildPanelViewModel({ issues, sessions: [], plansByNumber, limit: 200 })
    expect(model.rows.map((row) => row.code)).toEqual(['OPS109', 'OPS110'])
    expect(model.truncated).toBe(false)
    expect(model.counts.all).toBe(2)
    expect(model.counts['in-progress']).toBe(1)
  })

  it('flags truncation when the page fills the limit', () => {
    const model = buildPanelViewModel({ issues, limit: 2 })
    expect(model.truncated).toBe(true)
  })

  it('produces a JSON-safe payload with both plans', () => {
    const model = buildPanelViewModel({ issues, plansByNumber, limit: 200 })
    const payload = toJsonPayload(model)
    expect(payload.version).toBe(1)
    const row = payload.rows.find((entry: { code?: string }) => entry.code === 'OPS109')
    expect(row.plan.intention).toMatchObject({ classification: 'aprovado', status: 'aprovado' })
    expect(row.plan.impl).toMatchObject({ classification: 'andou', status: 'em execução' })
    expect(row.uiDraft).toEqual({
      path: 'docs/plans/ops109-painel-issues-no-terminal-ui-design.html',
      exists: true,
    })
    expect(row.session).toBeNull()
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })
})
