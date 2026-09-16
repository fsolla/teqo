#!/usr/bin/env node
/**
 * OPS109 — `pnpm issues:tui`: painel read-only de issues e planos no terminal.
 *
 *   pnpm issues:tui            TUI interativa (alternate screen + raw mode)
 *   pnpm issues:tui --json     imprime o view model (contrato não-interativo)
 *   pnpm issues:tui --help     ajuda
 *
 * A fonte dos dados é a camada de leitura existente: `github-api.listIssues`
 * (Issues + labels), `agent-session list --json` (contrato do OPS110) e os
 * `docs/plans/*.md` no disco. A derivação mora em `scripts/lib/issues-panel.mjs`
 * (puro/testável); aqui fica só o I/O (fetch, spawn, disco) e o render.
 *
 * Guardrails: read-only sobre tracker e planos; não inicia run (só anexa a
 * sessão existente via `agent:session attach`); sem token/rede vira mensagem
 * clara, nunca stack trace; sair nunca deixa o terminal em raw mode.
 *
 *   Teclas na lista:    ↑↓ mover · enter abrir · 1-4 filtrar · r recarregar · q sair
 *   No detalhe:         esc voltar · enter abrir plano · w design UI · s sessão · o GitHub
 *   No leitor:          ↑↓ rolar · pgup/pgdn página · esc voltar
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  bold,
  clearLine,
  dim,
  enterAlternateScreen,
  hideCursor,
  leaveAlternateScreen,
  moveTo,
  padToWidth,
  SGR,
  showCursor,
  stripAnsi,
  style,
  terminalSize,
  tone,
  truncateToWidth,
  visibleWidth,
} from './lib/ansi.mjs'
import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'
import { githubApi as api } from './lib/github-api.mjs'
import {
  buildPanelViewModel,
  filterByState,
  planLabel,
  resolveUiDraft,
  toJsonPayload,
  visibleWindow,
} from './lib/issues-panel.mjs'
import { renderMarkdown, wrapInline } from './lib/markdown-ansi.mjs'

const die = dieWithLabel('issues:tui')

/** GitHub caps `per_page` at 100 — the panel never promises more than that. */
const MAX_LIMIT = 100

const USAGE = `Uso: pnpm issues:tui [--json] [--limit=N] [--help]

  (sem flags)   TUI interativa (↑↓ mover · enter abrir · 1-4 filtrar · r recarregar · q sair)
  --json        imprime o view model das issues (não-interativo, para teste/script)
  --limit=N     teto de issues a ler (default 100, o teto de per_page do GitHub)
  --help        esta ajuda

Read-only sobre o tracker e os planos; a sessão do agente é consumida via
\`pnpm agent:session list --json\` (OPS110). Exige GITHUB_TOKEN no ambiente.`

const FILTERS = ['all', 'in-progress', 'waiting', 'done']
const FILTER_LABELS = {
  all: 'todas',
  'in-progress': 'em andamento',
  waiting: 'aguardando',
  done: 'concluídas',
}

const STATE_MARK = {
  'in-progress': { mark: '●', tone: 'wait', label: 'em andamento' },
  ready: { mark: '○', tone: 'neutral', label: 'pronta' },
  blocked: { mark: '■', tone: 'bad', label: 'travada' },
  done: { mark: '✓', tone: 'ok', label: 'concluída' },
  'in-prod': { mark: '✓', tone: 'ok', label: 'em produção' },
  open: { mark: '○', tone: 'neutral', label: 'aberta' },
}

const stateCell = (state) => {
  const entry = STATE_MARK[state] ?? STATE_MARK.open
  return tone(entry.tone, `${entry.mark} ${entry.label}`)
}

const classificationTone = (classification) =>
  ({ aprovado: 'ok', andou: 'ok', aguardando: 'wait', desconhecido: 'neutral' })[classification] ??
  'neutral'

// --- I/O ---------------------------------------------------------------------

/**
 * Read the plan files for one row from disk (repo root = cwd). Missing files
 * come back null — “sem plano” / “impl não criado” are first-class states.
 * The design UI only needs its existence verdict and real path (content never
 * rendered): `resolveUiDraft` probes current `-ui-design.html` first and falls
 * back to the legacy `-ui-draft.html`, keeping the precedence in the pure lib.
 */
const readPlans = (row) => {
  const readIfExists = (path) => {
    if (!path) return null
    const absolute = resolve(process.cwd(), path)
    try {
      return readFileSync(absolute, 'utf8')
    } catch {
      return null
    }
  }
  const isFileOnDisk = (path) => Boolean(path) && existsSync(resolve(process.cwd(), path))
  return {
    intention: readIfExists(row.plan.intention?.path),
    impl: readIfExists(row.plan.impl?.path),
    uiDraft: resolveUiDraft(row.plan.intention?.path ?? null, isFileOnDisk),
  }
}

/** Sessions via the OPS110 contract. Failure degrades to “no sessions”. */
const loadSessions = () => {
  const result = spawnSync(process.execPath, ['scripts/agent-session.mjs', 'list', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 15_000,
  })
  if (result.status !== 0 || !result.stdout) {
    return {
      sessions: [],
      warning: 'estado das sessões indisponível (OPS110) — mostrando sem sessões.',
    }
  }
  try {
    const payload = JSON.parse(result.stdout)
    const sessions = (payload.sessions ?? []).map((session) => ({
      ...session,
      status: session.status ?? 'unknown',
    }))
    return { sessions, warning: null }
  } catch {
    return { sessions: [], warning: 'estado das sessões ilegível — mostrando sem sessões.' }
  }
}

/**
 * Load the full view model. Network/token failures raise a typed error the
 * caller renders as the cena-4 error screen.
 */
const loadViewModel = async ({ limit, withPlans = true }) => {
  if (!process.env.GITHUB_TOKEN) {
    const error = new Error('GITHUB_TOKEN não definido no ambiente.')
    error.code = 'NO_TOKEN'
    throw error
  }
  const issues = await api.listIssues({ state: 'all', limit })
  const { sessions, warning: sessionWarning } = loadSessions()
  const base = buildPanelViewModel({ issues, sessions, limit })
  if (withPlans) {
    const plansByNumber = new Map()
    for (const row of base.rows) plansByNumber.set(row.number, readPlans(row))
    return {
      ...buildPanelViewModel({ issues, sessions, plansByNumber, limit }),
      sessionWarning,
    }
  }
  return { ...base, sessionWarning }
}

// --- Render ------------------------------------------------------------------

/**
 * Paint the frame: header, filter chips, rows (with the cursor inverted) and
 * the contextual footer. Narrow terminals (<96 cols, the wide row's minimum)
 * get the phone layout — 2 lines per row — and every line is truncated to the
 * width so nothing wraps or overflows on an 80-col SSH window.
 */
const renderList = (viewModel, { width, height, filter, cursor, message, error }) => {
  const narrow = width < 96
  const lines = []
  const counts = viewModel.counts
  const push = (line) => lines.push(truncateToWidth(line, width))

  if (error) {
    lines.push(bold('teqo · issues'))
    lines.push('')
    push(tone('bad', `erro: ${error}`))
    push('Nada foi alterado. Defina o token e rode de novo:')
    push(style(SGR.cyan, 'GITHUB_TOKEN=… pnpm issues:tui'))
    lines.push('')
    lines.push(dim('r tentar de novo · q sair'))
    return lines
  }

  lines.push(
    narrow
      ? bold('teqo · issues')
      : truncateToWidth(
          `${bold('teqo · issues')}  ${dim('|')}  repo fsolla/teqo  ${dim(`| ${viewModel.rows.length} rastreáveis`)}`,
          width,
        ),
  )

  const chips = FILTERS.map((key, index) => {
    const active = key === filter
    if (narrow) {
      const short = { all: 'todas', 'in-progress': 'andam.', waiting: 'aguard.', done: 'feitas' }[
        key
      ]
      const label = `${index + 1} ${short}`
      return active ? style(SGR.inverse, label) : dim(label)
    }
    const label = `${index + 1} ${FILTER_LABELS[key]} (${counts[key]})`
    return active ? style(SGR.inverse, label) : dim(label)
  })
  push(chips.join(narrow ? ' ' : '  '))

  if (viewModel.truncated) {
    push(dim(`mostrando as ${viewModel.limit} mais recentes`))
  }
  if (viewModel.sessionWarning) {
    push(dim(viewModel.sessionWarning))
  }

  const rows = filterByState(viewModel.rows, filter)
  if (rows.length === 0) {
    lines.push('')
    push(dim(`Nenhuma issue em “${FILTER_LABELS[filter]}” no momento.`))
    push(dim('1-4 troca o filtro · q sai'))
  }

  const reserved = 3
  const bodyHeight = Math.max(1, height - lines.length - reserved)
  const rowHeight = narrow ? 2 : 1
  const capacity = Math.max(1, Math.floor(bodyHeight / rowHeight))
  const { start, end } = visibleWindow({ count: rows.length, cursor, capacity })
  const visible = rows.slice(start, end)

  if (!narrow && rows.length > 0) {
    lines.push(
      style(
        SGR.bold,
        `${padToWidth('estado', 20)}${padToWidth('id', 10)}${padToWidth('título', 40)}${padToWidth('plano', 22)}prio`,
      ),
    )
  }

  visible.forEach((row, index) => {
    const absolute = start + index
    const selected = absolute === cursor
    const rowTitle = `${row.code ?? `#${row.number}`} ${row.title}`
    if (narrow) {
      const sessionMark = row.session ? ' ◆' : ''
      const head = `${stateCell(row.state)} · ${row.code ?? `#${row.number}`} · ${row.priority}${sessionMark}`
      const detail = rowTitle
      lines.push(
        selected ? style(SGR.inverse, padToWidth(stripAnsi(head), width)) : padToWidth(head, width),
      )
      lines.push(
        selected
          ? style(SGR.inverse, padToWidth(truncateToWidth(detail, width), width))
          : dim(padToWidth(truncateToWidth(detail, width), width)),
      )
      return
    }
    const actionTone =
      row.action === 'aguardando aprovação'
        ? 'wait'
        : row.action === 'em andamento'
          ? 'accent'
          : row.action.startsWith('travada')
            ? 'bad'
            : row.action === 'concluída'
              ? 'ok'
              : 'neutral'
    const sessionMark =
      row.session && (row.session.status === 'working' || row.session.status === 'idle')
        ? tone('ok', ' ◆')
        : ''
    const cell = `${padToWidth(stateCell(row.state), 20)}${padToWidth(row.code ?? `#${row.number}`, 10)}${padToWidth(truncateToWidth(row.title, 39), 40)}${padToWidth(tone(actionTone, truncateToWidth(planLabel(row), 20)), 22)}${row.priority}${sessionMark}`
    lines.push(
      selected ? style(SGR.inverse, padToWidth(stripAnsi(cell), width)) : padToWidth(cell, width),
    )
  })

  while (lines.length < height - 1) lines.push('')
  lines.push(
    message
      ? tone('ok', truncateToWidth(message, width))
      : dim(
          truncateToWidth('↑↓ navegar · enter abrir · 1-4 filtrar · r recarregar · q sair', width),
        ),
  )
  return lines.slice(0, height)
}

/** Detail screen: meta, summary, both plans with status, and the actions. */
const renderDetail = (row, { width, height, message }) => {
  const lines = []
  const push = (line) => lines.push(truncateToWidth(line, width))
  const header = `${row.code ?? ''} — ${row.title}`.trim()
  push(bold(header))
  push(
    `Issue #${row.number} · prio ${row.priority} · kind ${row.kind} · depends ${row.depends.join(', ') || '—'} · ${row.url}`,
  )
  const stateEntry = STATE_MARK[row.state] ?? STATE_MARK.open
  push(tone(stateEntry.tone, `${stateEntry.mark} ${stateEntry.label} · ação: ${row.action}`))

  lines.push('')
  lines.push(dim('resumo'))
  const summary = row.summary || '(sem resumo no body — veja o GitHub)'
  for (const piece of wrapInline(summary, width)) push(piece)

  lines.push('')
  lines.push(dim('planos'))
  const planLine = (label, plan, fallback) => {
    if (!plan || !plan.path || !plan.exists) {
      return `${tone('neutral', `○ ${label}`)} · ${dim(fallback)} · ${dim(`GitHub: ${row.url}`)}`
    }
    const classification = plan.classification
    const statusLabel =
      classification === 'aprovado'
        ? tone('ok', `✓ aprovado`)
        : classification === 'aguardando'
          ? tone('wait', `◌ aguardando aprovação`)
          : classification === 'andou'
            ? tone('ok', `✓ ${plan.status?.raw ?? 'andou'}`)
            : tone('neutral', `? ${plan.status?.raw ?? 'status desconhecido'}`)
    return `${statusLabel} · ${plan.path} · ${dim('enter abre')}`
  }
  push(planLine('intenção', row.plan.intention, 'sem plano'))
  push(planLine('implementação', row.plan.impl, 'impl não criado'))

  lines.push('')
  lines.push(dim('ações'))
  push(
    row.uiDraft.exists
      ? `${style(SGR.cyan, 'w')} abrir design UI no browser · ${row.uiDraft.path}`
      : dim('w design UI: não tem (classe A)'),
  )
  if (row.session) {
    push(
      `${style(SGR.cyan, 's')} abrir sessão do agente · ${tone('ok', `run ${row.session.status}`)} · ${row.session.branch}`,
    )
  } else {
    push(
      `${style(SGR.cyan, 's')} ${dim('sessão do agente: nenhuma ativa (o painel não inicia run)')}`,
    )
  }
  push(`${style(SGR.cyan, 'o')} abrir a issue no GitHub`)

  while (lines.length < height - 1) lines.push('')
  lines.push(
    message
      ? tone('ok', truncateToWidth(message, width))
      : dim(
          truncateToWidth(
            'esc voltar · enter abrir plano · w design UI · s sessão · o GitHub',
            width,
          ),
        ),
  )
  return lines.slice(0, height)
}

/** Reader screen: rendered markdown with a scroll offset and a progress %. */
const renderReader = (plan, { width, height, scroll, total }) => {
  const lines = []
  const status = plan.status?.raw ?? plan.classification
  const progress = total <= 0 ? 100 : Math.min(100, Math.round(((scroll + height) / total) * 100))
  const progressLabel = `${progress}%`
  const titleWidth = Math.max(10, width - visibleWidth(status) - visibleWidth(progressLabel) - 6)
  const title = truncateToWidth(plan.path, titleWidth)
  lines.push(
    truncateToWidth(
      `${bold(title)}  ${tone(classificationTone(plan.classification), status)}  ${dim(progressLabel)}`,
      width,
    ),
  )
  for (const line of plan.lines.slice(scroll, scroll + Math.max(1, height - 2))) {
    lines.push(truncateToWidth(line, width))
  }
  while (lines.length < height - 1) lines.push('')
  lines.push(dim(truncateToWidth('↑↓ rolar · pgup/pgdn página · esc voltar à issue', width)))
  return lines.slice(0, height)
}

/**
 * Draw one frame. No newline after the last row: writing one would scroll the
 * alternate screen by a line every frame (the frame's first row would drift).
 */
const paint = (lines, { width, height }) => {
  const frame = []
  for (let row = 0; row < height; row += 1) {
    frame.push(`${padToWidth(lines[row] ?? '', width)}${clearLine()}`)
  }
  process.stdout.write(`${hideCursor()}${moveTo(1, 1)}${frame.join('\n')}`)
}

// --- Interactions ------------------------------------------------------------

/** Open a local file in the machine's default browser, or print the path. */
const openInBrowser = (path) => {
  const absolute = resolve(process.cwd(), path)
  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  if (hasDisplay) {
    const result = spawnSync(opener, [absolute], { stdio: 'ignore' })
    if (result.status === 0) return { opened: true, message: `abrindo ${path} no browser` }
  }
  return { opened: false, message: `sem browser/display — abra manualmente: ${absolute}` }
}

/** Attach to the existing agent session. Never starts a run (OPS110 contract). */
const attachSession = (row) => {
  if (!row.session) return { message: 'nenhuma sessão ativa — o painel não inicia run.' }
  const result = spawnSync(
    process.execPath,
    [
      'scripts/agent-session.mjs',
      'attach',
      `--issue=${row.number}`,
      `--session=${row.session.sessionID}`,
    ],
    { cwd: process.cwd(), stdio: 'inherit' },
  )
  return {
    message:
      result.status === 0
        ? 'sessão encerrada — de volta ao painel'
        : 'não consegui anexar à sessão',
  }
}

const openGithub = (row) => {
  const result = openInBrowser(row.url)
  return { message: result.opened ? `abrindo ${row.url}` : `abra manualmente: ${row.url}` }
}

/** Known multi-byte key sequences, longest first so `esc` never wins early. */
const KEY_SEQUENCES = [
  ['\u001b[5~', 'pgup'],
  ['\u001b[6~', 'pgdn'],
  ['\u001b[A', 'up'],
  ['\u001b[B', 'down'],
  ['\u001b', 'esc'],
  ['\r', 'enter'],
  ['\n', 'enter'],
  ['\u007f', 'backspace'],
  ['\b', 'backspace'],
].sort((left, right) => right[0].length - left[0].length)

/**
 * Key-press reader for raw-mode stdin. Buffers every token of a chunk (a
 * fast key repeat can deliver several in one `data` event), resolves `q` on
 * EOF so the loop never hangs, and normalizes to `up`/`down`/`enter`/`esc`/
 * `pgup`/`pgdn`/`backspace` or the literal character.
 * @param {NodeJS.ReadStream} stdin
 */
const createKeyReader = (stdin) => {
  const queue = []
  let waiting = null
  let ended = false

  const resolveNext = () => {
    if (waiting && queue.length > 0) {
      const done = waiting
      waiting = null
      done(queue.shift())
    }
  }

  const onData = (buffer) => {
    const text = buffer.toString('utf8')
    let index = 0
    while (index < text.length) {
      const sequence = KEY_SEQUENCES.find(([token]) => text.startsWith(token, index))
      if (sequence) {
        queue.push(sequence[1])
        index += sequence[0].length
        continue
      }
      queue.push(text[index])
      index += 1
    }
    resolveNext()
  }

  const onEnd = () => {
    ended = true
    if (waiting) {
      const done = waiting
      waiting = null
      done('q')
    }
  }

  stdin.on('data', onData)
  stdin.once('end', onEnd)
  stdin.once('close', onEnd)

  return {
    next: () =>
      new Promise((done) => {
        if (queue.length > 0) {
          done(queue.shift())
          return
        }
        if (ended) {
          done('q')
          return
        }
        waiting = done
      }),
    dispose: () => {
      stdin.removeListener('data', onData)
      stdin.removeListener('end', onEnd)
      stdin.removeListener('close', onEnd)
    },
  }
}

/**
 * Drive the interactive TUI until `q`. Raw mode and the alternate screen are
 * restored in `finally` and on fatal signals — a crash must never leave the
 * terminal in raw mode.
 */
const runTui = async ({ limit }) => {
  const stdin = process.stdin
  const stdout = process.stdout
  const isTty = Boolean(stdin.isTTY && stdout.isTTY)

  let viewModel = null
  let error = null
  let message = null
  const reload = async () => {
    try {
      viewModel = await loadViewModel({ limit })
      error = null
    } catch (caught) {
      viewModel = null
      error =
        caught?.code === 'NO_TOKEN' ? caught.message : `falha ao ler as issues: ${caught.message}`
    }
  }
  await reload()

  const state = {
    screen: 'list',
    filter: 'all',
    cursor: 0,
    row: null,
    plan: null,
    scroll: 0,
  }

  const keys = createKeyReader(stdin)
  const cleanup = () => {
    keys.dispose()
    if (isTty && stdin.setRawMode) stdin.setRawMode(false)
    stdin.pause()
    if (isTty) stdout.write(`${showCursor()}${leaveAlternateScreen()}`)
  }

  const onFatal = (error) => {
    if (error?.stack) process.stderr.write(`${error.stack}\n`)
    cleanup()
    process.exit(1)
  }
  process.once('SIGINT', onFatal)
  process.once('SIGTERM', onFatal)
  process.once('uncaughtException', onFatal)

  if (isTty) {
    if (stdin.setRawMode) stdin.setRawMode(true)
    stdin.resume()
    stdout.write(enterAlternateScreen())
  }

  try {
    let running = true
    while (running) {
      const { columns, rows } = terminalSize({ columns: stdout.columns, rows: stdout.rows })
      const width = Math.max(40, columns)
      const height = Math.max(10, rows)

      const visibleRows = viewModel ? filterByState(viewModel.rows, state.filter) : []
      state.cursor = Math.max(0, Math.min(state.cursor, Math.max(0, visibleRows.length - 1)))

      let lines
      if (state.screen === 'reader' && state.plan) {
        lines = renderReader(state.plan, {
          width,
          height,
          scroll: state.scroll,
          total: state.plan.lines.length,
        })
      } else if (state.screen === 'detail' && state.row) {
        lines = renderDetail(state.row, { width, height, message })
      } else {
        lines = renderList(viewModel ?? { rows: [], counts: {}, truncated: false, limit }, {
          width,
          height,
          filter: state.filter,
          cursor: state.cursor,
          message,
          error,
        })
      }
      if (isTty) paint(lines, { width, height })
      else stdout.write(`${lines.map((line) => `${line}\n`).join('')}\n`)

      message = null
      if (!isTty) {
        running = false
        continue
      }

      const key = await keys.next()

      if (state.screen === 'reader') {
        const maxScroll = Math.max(0, state.plan.lines.length - (height - 2))
        if (key === 'up') state.scroll = Math.max(0, state.scroll - 1)
        else if (key === 'down') state.scroll = Math.min(maxScroll, state.scroll + 1)
        else if (key === 'pgup') state.scroll = Math.max(0, state.scroll - (height - 2))
        else if (key === 'pgdn') state.scroll = Math.min(maxScroll, state.scroll + (height - 2))
        else if (key === 'esc' || key === 'q') state.screen = 'detail'
        continue
      }

      if (state.screen === 'detail') {
        if (key === 'esc') state.screen = 'list'
        else if (key === 'o') message = openGithub(state.row).message
        else if (key === 'w') {
          if (!state.row.uiDraft.exists) message = 'w design UI: não tem (classe A)'
          else message = openInBrowser(state.row.uiDraft.path).message
        } else if (key === 's') {
          message = attachSession(state.row).message
          await reload()
          state.row =
            viewModel?.rows.find((entry) => entry.number === state.row.number) ?? state.row
        } else if (key === 'enter') {
          const openPlan = async (plan) => {
            if (!plan || !plan.exists) {
              message = plan?.path ? `plano não encontrado: ${plan.path}` : 'sem plano para abrir'
              return
            }
            const markdown = readFileSync(resolve(process.cwd(), plan.path), 'utf8')
            state.plan = {
              ...plan,
              lines: renderMarkdown(markdown, { width: Math.max(20, width - 2) }),
            }
            state.scroll = 0
            state.screen = 'reader'
          }
          // enter opens the impl when present, else the intention (UI draft order).
          await openPlan(
            state.row.plan.impl?.exists ? state.row.plan.impl : state.row.plan.intention,
          )
        } else if (key === 'q') running = false
        continue
      }

      // list screen
      if (key === 'q') running = false
      else if (key === 'up') state.cursor = Math.max(0, state.cursor - 1)
      else if (key === 'down') state.cursor = Math.min(visibleRows.length - 1, state.cursor + 1)
      else if (['1', '2', '3', '4'].includes(key)) {
        state.filter = FILTERS[Number(key) - 1]
        state.cursor = 0
      } else if (key === 'r') {
        await reload()
        state.cursor = 0
        message = 'recarregado'
      } else if (key === 'enter' && visibleRows[state.cursor]) {
        state.row = visibleRows[state.cursor]
        state.screen = 'detail'
      }
    }
  } finally {
    cleanup()
  }
}

// --- Entry -------------------------------------------------------------------

const { flags, positional } = parseEqualsFlags(process.argv.slice(2))
if (positional.length > 0) {
  die(`argumento posicional inesperado: ${positional.join(' ')} (veja pnpm issues:tui --help)`)
}

if (flags.help) {
  console.log(USAGE)
  process.exit(0)
}

const rawLimit = flags.limit ?? String(MAX_LIMIT)
if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) {
  die(`--limit inválido: ${flags.limit === true ? '(sem valor)' : rawLimit}`)
}
const limit = Math.min(Number(rawLimit), MAX_LIMIT)

try {
  if (flags.json) {
    const viewModel = await loadViewModel({ limit, withPlans: true })
    console.log(JSON.stringify(toJsonPayload(viewModel), null, 2))
    if (viewModel.sessionWarning) console.error(`[issues:tui] ${viewModel.sessionWarning}`)
  } else {
    await runTui({ limit })
  }
} catch (error) {
  if (error?.code === 'NO_TOKEN') {
    die(
      'GITHUB_TOKEN não definido no ambiente.\nNada foi alterado. Defina o token e rode de novo:\n\n  GITHUB_TOKEN=… pnpm issues:tui',
    )
  }
  die(error?.message ?? String(error))
}
