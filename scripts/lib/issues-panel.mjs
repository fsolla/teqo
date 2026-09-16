/**
 * OPS109 — derivação pura do painel de issues (`pnpm issues:tui`).
 *
 * Todo o conhecimento do painel mora aqui: estado/ação da Issue, leitura do
 * `Status:` dos planos, descoberta do plano de intenção/impl/design UI e o
 * casamento com a sessão do agente do OPS110. Puro por contrato — recebe os
 * insumos (issues normalizadas do `github-api`, sessões do
 * `agent-session list --json` e os planos já lidos do disco) e devolve o view
 * model; o CLI só faz I/O e render. Reusa a camada existente sem twin:
 * `labelNames`/`priorityRank`/`parseFrontmatter` (agent-forgejo),
 * `extractPlanPath` (agent-pool-prompt) e `resolveSessionRef` (agent-session).
 */

import { labelNames, parseFrontmatter, priorityRank } from './agent-forgejo.mjs'
import { extractPlanPath } from './agent-pool-prompt.mjs'
import { resolveSessionRef } from './agent-session.mjs'

/** Issue state labels the panel reads (GitHub tracker labels). */
const ISSUE_STATES = ['ready', 'in-progress', 'blocked', 'done', 'in-prod']

/** Filter keys of the list, mirroring the UI draft's `1-4` shortcut. */
const FILTER_KEYS = ['all', 'in-progress', 'waiting', 'done']

/** Plan status → product classification (intent doc's assumed reading). */
const CLASSIFICATIONS = [
  { kind: 'aprovado', prefixes: ['aprovado', 'aprovada'] },
  {
    kind: 'andou',
    prefixes: [
      'em execução',
      'executado',
      'executada',
      'entregue',
      'implementado',
      'pronta',
      'pronto',
      'produção',
      'em produção',
    ],
  },
  {
    kind: 'aguardando',
    prefixes: ['rascunho', 'registrado', 'blocked', 'bloqueado', 'aguardando', 'pendente'],
  },
]

/**
 * Extract the `Status:` line of a plan, tolerating the real-world mess:
 * `**bold**`, backticks, an em dash separator and parenthetical suffixes
 * (`aprovado (gate humano 2026-09-15)`). Returns the raw value (always shown)
 * plus a normalized lowercase form used for classification.
 * @param {string} markdown
 * @returns {{ raw: string, normalized: string } | null}
 */
export const parsePlanStatus = (markdown) => {
  for (const line of String(markdown ?? '').split('\n')) {
    const match = /^[\s>*-]*\*{0,2}Status:?\*{0,2}\s*(.+)$/i.exec(line.trim())
    if (!match) continue
    const raw = match[1]
      .replace(/`/g, '')
      .replace(/\*{1,2}/g, '')
      .replace(/\s+$/g, '')
      .trim()
    if (!raw) continue
    return { raw, normalized: raw.toLowerCase() }
  }
  return null
}

/**
 * Classify a raw `Status:` value into the product reading. Unknown values
 * fail safe to `desconhecido` — the panel shows the raw line and never
 * invents “aprovado”. The messy real-world `plano — registrado (…)` variant
 * is normalized by dropping the leading `plano` label before matching.
 * @param {{ raw: string, normalized: string } | string | null} status
 * @returns {'aprovado' | 'andou' | 'aguardando' | 'desconhecido'}
 */
export const classifyPlanStatus = (status) => {
  const normalized = (typeof status === 'string' ? status : (status?.normalized ?? ''))
    .toLowerCase()
    .replace(/^plano\s*[—–-]\s*/u, '')
  if (!normalized) return 'desconhecido'
  const hit = CLASSIFICATIONS.find(({ prefixes }) =>
    prefixes.some((prefix) => normalized.startsWith(prefix)),
  )
  return hit ? hit.kind : 'desconhecido'
}

/**
 * Sibling-file conventions of the plans (`docs/plans/<slug>.md`,
 * `docs/plans/<slug>-impl.md`, `docs/plans/<slug>-ui-design.html`,
 * `docs/plans/<slug>-ui-draft.html`). Given the intent path, derive the other
 * three; the caller confirms existence on disk. `uiDesign` is the current
 * name (OPS114) and `uiDraft` is the legacy name (OPS109) — the two are
 * alternative names for the SAME artifact, never two artifacts. The
 * historical `uiDraft` key stays for retrocompat; `resolveUiDraft` owns the
 * precedence between them.
 * @param {string | null} planPath
 */
export const siblingPlanPaths = (planPath) => {
  const path = typeof planPath === 'string' ? planPath.trim() : ''
  if (!/\.md$/.test(path)) return { impl: null, uiDesign: null, uiDraft: null }
  const stem = path.replace(/\.md$/, '')
  const base = stem.endsWith('-impl') ? stem.slice(0, -'-impl'.length) : stem
  return {
    impl: `${base}-impl.md`,
    uiDesign: `${base}-ui-design.html`,
    uiDraft: `${base}-ui-draft.html`,
  }
}

/**
 * Pick the design artifact of a plan: `<base>-ui-design.html` (current name,
 * OPS114) wins over `<base>-ui-draft.html` (legacy, immutable acervo). Pure by
 * contract — the caller injects the existence predicate, so the lib never
 * touches disk. When neither file exists the verdict is the current name with
 * `exists: false`: the panel teaches the live convention and the legacy
 * fallback still applies on disk.
 * @param {string | null} planPath
 * @param {(path: string) => boolean} [exists]
 * @returns {{ path: string | null, exists: boolean }}
 */
export const resolveUiDraft = (planPath, exists = () => false) => {
  const { uiDesign, uiDraft } = siblingPlanPaths(planPath)
  if (uiDesign && exists(uiDesign)) return { path: uiDesign, exists: true }
  if (uiDraft && exists(uiDraft)) return { path: uiDraft, exists: true }
  return { path: uiDesign, exists: false }
}

/** Which issue state label the panel shows (closed wins as `done`). */
export const issueState = (issue) => {
  const labels = labelNames(issue)
  if (issue.state === 'CLOSED') {
    return labels.includes('in-prod') ? 'in-prod' : 'done'
  }
  const stateLabel = labels.find((label) => ISSUE_STATES.includes(label))
  return stateLabel ?? 'open'
}

/** Priority label → `P0..P3`, defaulting to P2 like the other CLIs. */
const issuePriority = (issue) =>
  labelNames(issue)
    .find((label) => /^prio:P[0-3]$/.test(label))
    ?.replace('prio:', '') ?? 'P2'

/** Kind label → `feature` when absent. */
const issueKind = (issue) =>
  labelNames(issue)
    .find((label) => label.startsWith('kind:'))
    ?.replace('kind:', '') ?? 'feature'

/** Frontmatter `id` of an issue, or null (delegates to the shared parser). */
export const issueCode = (issue) => {
  const { meta } = parseFrontmatter(issue.body)
  return typeof meta.id === 'string' && meta.id.length > 0 ? meta.id : null
}

/** Frontmatter `depends` of an issue (ids), via the shared parser. */
export const issueDepends = (issue) => {
  const { meta } = parseFrontmatter(issue.body)
  return Array.isArray(meta.depends) ? meta.depends : []
}

/** Body without the frontmatter block — the human summary. */
export const issueSummary = (issue) => {
  const { rest } = parseFrontmatter(issue.body)
  return rest
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^Plano:/.test(line) && !/^#/.test(line))
    .slice(0, 3)
    .join(' ')
}

/** GitHub URL of the issue (the escape hatch when a plan is missing). */
const issueUrl = (issue, repository = 'fsolla/teqo') =>
  `https://github.com/${repository}/issues/${issue.number}`

/**
 * The pending action of an issue, in operator terms. Priority: blocked dep
 * wins (it cannot move), then a plan awaiting approval, then the execution
 * label, else the plain state.
 * @param {{ state: string, plan: { intention: { classification?: string } | null, impl: { classification?: string } | null }, blockedBy: string[] }} view
 */
export const issueAction = (view) => {
  if (view.blockedBy.length > 0) return `travada (depends ${view.blockedBy.join(', ')})`
  if (view.state === 'blocked') return 'travada'
  if (view.state === 'in-progress') return 'em andamento'
  const waiting = [view.plan.intention, view.plan.impl].some(
    (plan) => plan && plan.classification === 'aguardando',
  )
  if (waiting) return 'aguardando aprovação'
  if (view.state === 'done' || view.state === 'in-prod') return 'concluída'
  if (view.state === 'ready') return 'pronta'
  return 'aberta'
}

/** Short plan cell for the list column (UI draft's `plano`). */
export const planLabel = (view) => {
  const { intention, impl } = view.plan
  if (impl?.exists) return `impl ${impl.status?.raw ?? impl.classification}`
  if (intention?.exists) return `intenção: ${intention.status?.raw ?? intention.classification}`
  if (impl?.path && !impl.exists) return 'impl não criado'
  return 'sem plano'
}

const planView = (kind, path, markdown) => {
  if (!path || markdown === null || markdown === undefined) {
    return { kind, path, exists: false, status: null, classification: path ? 'não criado' : 'none' }
  }
  const status = parsePlanStatus(markdown)
  const classification = status ? classifyPlanStatus(status) : 'desconhecido'
  return {
    kind,
    path,
    exists: true,
    status: status ? { raw: status.raw, classification } : null,
    classification,
  }
}

/**
 * Build one row of the panel from an issue and its already-read artifacts.
 * `intention`/`impl` carry the file contents, with `null`/missing meaning
 * “file does not exist”; `uiDraft` is the design verdict — the CLI checks the
 * sibling `.html` (current `-ui-design` first, legacy `-ui-draft` as fallback)
 * and hands back the real `{ path, exists }`; the panel never reads its
 * content. The legacy key name stays: it means “design UI, new or legacy”.
 * @param {object} issue normalized GitHub issue
 * @param {{ intention?: string|null, impl?: string|null, uiDraft?: { path: string|null, exists: boolean }|null, sessions?: Array<object>, doneIds?: Set<string>, knownIds?: Set<string>, repository?: string }} [context]
 */
export const buildIssueRow = (issue, context = {}) => {
  const {
    intention = null,
    impl = null,
    uiDraft = null,
    sessions = [],
    doneIds = new Set(),
    knownIds = new Set(),
    repository,
  } = context
  const state = issueState(issue)
  const planPath = extractPlanPath(issue.body) ?? null
  const siblings = siblingPlanPaths(planPath)
  const intentionPath = planPath ?? siblings.impl?.replace(/-impl\.md$/, '.md') ?? null
  const implPath = planPath && /-impl\.md$/.test(planPath) ? planPath : siblings.impl
  const designVerdict = uiDraft ?? resolveUiDraft(planPath)

  const plan = {
    intention: planView('intention', intentionPath, intention),
    impl: planView('impl', implPath, impl),
  }
  const depends = issueDepends(issue)
  const blockedBy = depends.filter((id) => knownIds.has(id) && !doneIds.has(id))
  const session = resolveSessionRef({ states: sessions, issue: issue.number })

  const view = {
    number: issue.number,
    code: issueCode(issue),
    title: issue.title,
    state,
    priority: issuePriority(issue),
    kind: issueKind(issue),
    depends,
    blockedBy,
    summary: issueSummary(issue),
    url: issueUrl(issue, repository),
    plan,
    uiDraft: { path: designVerdict.path ?? null, exists: Boolean(designVerdict.exists) },
    session: session
      ? {
          status: session.status ?? 'unknown',
          sessionID: session.sessionID,
          branch: session.branch,
          dir: session.dir,
          issue: session.issue ?? null,
        }
      : null,
    action: '',
  }
  view.action = issueAction(view)
  return view
}

/**
 * Filter rows by the panel's filter key. Unknown keys behave like `all`
 * (fail-open for reading, never hides data silently).
 */
export const filterByState = (rows, key) => {
  const list = Array.isArray(rows) ? rows : []
  if (!FILTER_KEYS.includes(key) || key === 'all') return [...list]
  if (key === 'in-progress') return list.filter((row) => row.state === 'in-progress')
  if (key === 'waiting') return list.filter((row) => row.action === 'aguardando aprovação')
  return list.filter((row) => row.state === 'done' || row.state === 'in-prod')
}

/** Counts shown on the filter chips. */
export const filterCounts = (rows) => ({
  all: rows.length,
  'in-progress': filterByState(rows, 'in-progress').length,
  waiting: filterByState(rows, 'waiting').length,
  done: filterByState(rows, 'done').length,
})

/**
 * Sort panel rows: open work first (in-progress, waiting, ready), then
 * blocked, then done; priority ascending inside each band, then issue number.
 */
export const sortRows = (rows) => {
  const band = (state) => {
    if (state === 'in-progress') return 0
    if (state === 'ready') return 1
    if (state === 'blocked' || state === 'open') return 2
    return 3
  }
  return [...rows].sort((left, right) => {
    const byBand = band(left.state) - band(right.state)
    if (byBand !== 0) return byBand
    const byPriority = priorityRank(left.priority) - priorityRank(right.priority)
    if (byPriority !== 0) return byPriority
    return left.number - right.number
  })
}

/**
 * Scroll window of the list: which slice of `count` rows fits the current
 * cursor into `capacity` rows, keeping the cursor roughly centered. Pure so
 * the narrow/wide math is unit-tested instead of discovered on a pty.
 * @param {{ count: number, cursor: number, capacity: number }} input
 */
export const visibleWindow = ({ count, cursor, capacity }) => {
  const size = Math.max(1, Math.trunc(capacity))
  if (count <= size) return { start: 0, end: Math.max(0, count) }
  const clamped = Math.max(0, Math.min(cursor, count - 1))
  const start = Math.max(0, Math.min(clamped - Math.floor(size / 2), count - size))
  return { start, end: start + size }
}

/**
 * Assemble the full panel view model. Pure: the caller (CLI) does fetch,
 * spawn and disk reads, then hands the raw inputs here. `limit` is the
 * effective page size (GitHub caps `per_page` at 100 — the CLI clamps it).
 * @param {{ issues: Array<object>, sessions?: Array<object>, plansByNumber?: Map<number, { intention?: string|null, impl?: string|null, uiDraft?: { path: string|null, exists: boolean }|null }>, repository?: string, limit?: number }} input
 */
export const buildPanelViewModel = ({
  issues = [],
  sessions = [],
  plansByNumber = new Map(),
  repository,
  limit = 100,
} = {}) => {
  const trackable = issues.filter((issue) => issueCode(issue))
  const knownIds = new Set(trackable.map((issue) => issueCode(issue)))
  const doneIds = new Set(
    trackable
      .filter(
        (issue) => issue.state === 'CLOSED' || ['done', 'in-prod'].includes(issueState(issue)),
      )
      .map((issue) => issueCode(issue)),
  )
  const rows = sortRows(
    trackable.map((issue) => {
      const plans = plansByNumber.get(issue.number) ?? {}
      return buildIssueRow(issue, {
        intention: plans.intention ?? null,
        impl: plans.impl ?? null,
        uiDraft: plans.uiDraft,
        sessions,
        doneIds,
        knownIds,
        repository,
      })
    }),
  )
  return {
    rows,
    counts: filterCounts(rows),
    truncated: rows.length >= limit,
    limit,
  }
}

/**
 * Render one issue as JSON-safe line for `--json` (already plain objects).
 * Kept as a helper so the CLI contract is explicit about the shape. The
 * `uiDraft` key is the historical name of the design artifact and carries the
 * REAL path found on disk (current `-ui-design`, else legacy `-ui-draft`) —
 * `version: 1` and the `{ path, exists }` shape are frozen.
 * @param {object} viewModel
 */
export const toJsonPayload = (viewModel) => ({
  version: 1,
  truncated: viewModel.truncated,
  counts: viewModel.counts,
  rows: viewModel.rows.map((row) => ({
    number: row.number,
    code: row.code,
    title: row.title,
    state: row.state,
    priority: row.priority,
    kind: row.kind,
    action: row.action,
    depends: row.depends,
    blockedBy: row.blockedBy,
    url: row.url,
    plan: {
      intention: {
        path: row.plan.intention.path,
        exists: row.plan.intention.exists,
        classification: row.plan.intention.classification,
        status: row.plan.intention.status?.raw ?? null,
      },
      impl: {
        path: row.plan.impl.path,
        exists: row.plan.impl.exists,
        classification: row.plan.impl.classification,
        status: row.plan.impl.status?.raw ?? null,
      },
    },
    uiDraft: { path: row.uiDraft.path, exists: row.uiDraft.exists },
    session: row.session,
  })),
})
