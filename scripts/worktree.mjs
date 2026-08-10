/**
 * `pnpm worktree` — worktree management determinístico em torno da fila de
 * claim do projeto (mesma fila de `agent:claim` / agent pool).
 *
 *   pnpm worktree next [--issue N] [--stay] [--no-migrate]
 *                              claima a próxima Issue claimável ANTES de criar
 *                              o worktree a partir de origin/main (mesma fila
 *                              e lock otimista de `pnpm agent:claim`; claim
 *                              falhou → motivo e saída SEM worktree órfão);
 *                              branch `<code>-<slug>`.
 *                              `--issue N` claima a Issue direcionada (`ready`)
 *                              ou REABRE uma já claimada (`in-progress` — sem
 *                              re-claim; worktree reutilizado/criado e launch
 *                              na hora). O texto de saída avisa "já claimada —
 *                              não rodar `pnpm agent:claim`".
 *                              Por padrão imprime `cd <dir>` no fim — node
 *                              não muda o cwd do shell pai; o shell chamador
 *                              aplica (opencode/CDP usa o opencode command;
 *                              terminal interativo: função `worktree()` em
 *                              `.agents/shell/worktree.sh`, sourced no profile).
 *                              `--stay` suprime a linha `cd` (o claim ainda
 *                              acontece); `--go` explícito continua aceito como
 *                              no-op (era o antigo padrão).
 *                              Chamado do terminal interativo (com
 *                              `TEQO_WORKTREE_TERMINAL=1`, que só a função shell
 *                              seta), imprime também a diretiva `launch
 *                              opencode <dir> --model deepseek/deepseek-v4-flash
 *                              --auto --prompt "/work-issue --issue <N>"` ANTES
 *                              do `cd` — a função shell executa o cd e então a
 *                              linha, e o TUI do opencode abre no worktree com
 *                              `/work-issue --issue <N>` já enviado (OPS26 +
 *                              OPS33: o launch entrega a Issue claimada ao
 *                              agente; a skill lê o resto do GitHub). Presets
 *                              em scripts/lib/worktree.mjs. Sem o marcador
 *                              (comando `/worktree` do opencode), a diretiva
 *                              não é impressa — nunca abre TUI aninhado.
 *                              Também PROVISIONA o ambiente isolado do worktree:
 *                              porta do dev server + bancos próprios derivados
 *                              deterministicamente do branch (ver
 *                              scripts/lib/worktree-env.mjs), para agentes em
 *                              paralelo não disputarem porta 3000 nem o
 *                              `teqo_test` compartilhado. Migrations E seed
 *                              mínimo (`db:seed:minimal`, OPS28) são aplicados
 *                              aos dois bancos — paridade com a CI, que roda
 *                              `migrate → seed:minimal` antes do e2e.
 *                              `--no-migrate` pula migrations E o seed (que
 *                              depende do catálogo migrado).
 *   pnpm worktree plan [bag] [--stay] [--no-migrate]
 *                              cria um worktree de PLANEJAMENTO novo para rodar
 *                              a skill /plan-issue sem ocupar o main — cada
 *                              invocação cria UM DIFERENTE, para sessões de
 *                              planejamento paralelas: com `bag`, branch
 *                              `plans/plan-issue-<bag>` (e `-2`, `-3`, … se o
 *                              nome já estiver vivo); sem `bag`, o próximo
 *                              sequencial `plans/plan-issue-<n>` livre. Nenhum
 *                              deles (branch nem slot) colide com um `next`
 *                              posterior (prefixo minúsculo `plans/…`).
 *                              Mesmo provisionamento isolado do `next`; no
 *                              terminal, mesma diretiva `launch` — com
 *                              `--prompt /plan-issue` já enviado (OPS31: o TUI
 *                              abre no fluxo de planejamento, sem digitação).
 *   pnpm worktree new [bag] [--stay] [--no-migrate]
 *                              cria um worktree NEUTRO novo — sem função
 *                              pré-definida (explorar ideia, conversar, ou
 *                              planejar sem registrar nada): cada invocação
 *                              cria UM DIFERENTE; com `bag`, branch
 *                              `work/<bag>` (e `-2`, `-3`, … se o nome já
 *                              estiver vivo); sem `bag`, o próximo sequencial
 *                              `work/<n>` livre. Prefixo minúsculo `work/…` —
 *                              nunca colide com `<code>-<slug>` de `next` nem
 *                              com `plans/plan-issue-…` de `plan`.
 *                              Mesmo provisionamento isolado do `next`/`plan`;
 *                              no terminal, mesma diretiva `launch` — SEM
 *                              `--prompt` (apenas conversar, nenhuma skill).
 *                              `--stay` suprime a linha `cd` e a diretiva;
 *                              `--go` explícito continua aceito como no-op.
 *                              Migrations E seed mínimo nos dois bancos, como
 *                              o `next`/`plan` (OPS28).
 *   pnpm worktree kill [--force]   destrói o worktree em que o shell atual está
 *                              (recusa worktree sujo sem `--force`) e remove os
 *                              bancos gerados do worktree (best-effort); por
 *                              padrão termina imprimindo `cd <main>` para o
 *                              shell voltar ao worktree principal — o cwd nunca
 *                              fica num diretório destruído (não aceita
 *                              `--stay`; `--go` é no-op)
 *
 * Read-only no GitHub? NÃO — desde o OPS33 `next` CLAIMA: claim determinístico
 * antes do worktree (mesma fila/ordem e lock otimista do `pnpm agent:claim`;
 * `--issue N` claim direcionado ou reabre sessão já claimada). `plan`/`new`/
 * `kill` não tocam Issues. O claim do pool (supervisor coordenado) é intacto.
 * Dir raiz: `~/.cursor/worktrees/teqo/` (mesma casa dos worktrees do Cursor).
 */

import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { parse as parseEnv } from 'dotenv'
import pg from 'pg'

import {
  claimBriefLines,
  claimIssue,
  claimQueueEntry,
  claimTargetVerdict,
  dieAgent,
  ghJson,
  issuesById,
  nextClaimableIssue,
  parseArgs,
} from './lib/agent-github.mjs'
import { startSharedPostgres } from './lib/db-start.mjs'
import {
  DEV_PORT_BASE,
  GENERATED_ENV_MARKER,
  isGeneratedDatabaseName,
  worktreeEnvFileContents,
  worktreeEnvironment,
} from './lib/worktree-env.mjs'
import {
  branchNameForIssue,
  opencodeLaunchDirective,
  planBranchName,
  workBranchName,
  WORKTREE_TERMINAL_ENV,
} from './lib/worktree.mjs'

const die = dieAgent('worktree')
const WORKTREES_ROOT = join(homedir(), '.cursor', 'worktrees', 'teqo')

/**
 * True when the interactive terminal shell function (`.agents/shell/worktree.sh`)
 * calls us: it sets `TEQO_WORKTREE_TERMINAL=1` and executes the `launch`
 * directive we print. Without the marker (the `/worktree` opencode command,
 * automation) the launch line is never printed — no nested TUI.
 */
const terminalShell = process.env[WORKTREE_TERMINAL_ENV] === '1'

/** Print the `launch` directive (only exists from the terminal shell); the `cd` line stays last. */
const printLaunchDirective = ({ dir, purpose, issueNumber }) => {
  const line = opencodeLaunchDirective({ dir, purpose, terminal: terminalShell, issueNumber })
  if (line) console.log(line)
}

/** Maintenance database on the shared local container — only ever localhost. */
const MAINTENANCE_DATABASE_URL = 'postgresql://teqo:teqo@localhost:5432/postgres'

/** `git` wrapper; `okIfFails` swallows the failure and returns null instead. */
const git = (args, { okIfFails = false } = {}) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()
  } catch (error) {
    if (okIfFails) return null
    const stderr = (error.stderr?.toString() ?? '').trim()
    die(stderr || error.message || `git ${args.join(' ')} falhou`)
  }
  return null
}

/** Parse `git worktree list --porcelain` into [{ path, branch }]. */
const parseWorktreeList = (porcelain) => {
  const entries = []
  let current = null
  for (const raw of porcelain.split('\n')) {
    const line = raw.trimEnd()
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length), branch: null }
      entries.push(current)
    } else if (line.startsWith('branch refs/heads/')) {
      if (current) current.branch = line.slice('branch refs/heads/'.length)
    } else if (line === '') {
      current = null
    }
  }
  return entries
}

/**
 * Slots already claimed by OTHER live worktrees, read from their generated
 * `.env.local` (only files carrying the marker count — manual envs claim
 * nothing and are never overwritten).
 */
const readLiveSlots = (entries, excludedDir) => {
  const slots = new Set()
  for (const entry of entries) {
    if (resolve(entry.path) === resolve(excludedDir)) continue
    try {
      const text = readFileSync(join(entry.path, '.env.local'), 'utf8')
      if (!text.includes(GENERATED_ENV_MARKER)) continue
      const match = /^PORT=([0-9]+)/m.exec(text)
      const slot = match ? Number(match[1]) - DEV_PORT_BASE : null
      if (slot !== null && Number.isInteger(slot) && slot >= 0) slots.add(slot)
    } catch {
      // worktree dir without a generated env file — nothing claimed
    }
  }
  return slots
}

/** Merge the main repo's `.env` then `.env.local` (local wins) — secret source. */
const readMainEnv = (mainRoot) => {
  const merged = {}
  for (const name of ['.env', '.env.local']) {
    try {
      Object.assign(merged, parseEnv(readFileSync(join(mainRoot, name), 'utf8')))
    } catch {
      // file missing — fine
    }
  }
  return merged
}

const envFileIsGenerated = (dir, name) => {
  try {
    return readFileSync(join(dir, name), 'utf8').includes(GENERATED_ENV_MARKER)
  } catch {
    return false
  }
}

/** `CREATE DATABASE` for each missing generated name on the shared container. */
const ensureDatabases = async (names) => {
  const client = new pg.Client({
    connectionString: MAINTENANCE_DATABASE_URL,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()
  try {
    for (const name of names) {
      if (!isGeneratedDatabaseName(name)) die(`Nome de banco gerado inválido: ${name}`)
      const { rows } = await client.query('SELECT 1 AS ok FROM pg_database WHERE datname = $1', [
        name,
      ])
      if (rows.length > 0) {
        console.log(`[worktree] banco ${name} já existe.`)
        continue
      }
      await client.query(`CREATE DATABASE ${name}`)
      console.log(`[worktree] banco criado: ${name}`)
    }
  } finally {
    await client.end().catch(() => {})
  }
}

const ensureWorktreeDeps = (dir) => {
  if (existsSync(join(dir, 'node_modules', '.bin', 'payload'))) return
  console.log('[worktree] ▶ node_modules ausente — pnpm install --frozen-lockfile …')
  execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: dir, stdio: 'inherit' })
}

const runMigrate = (dir, databaseUrl, payloadSecret) => {
  console.log(`[worktree] ▶ migrations em ${databaseUrl} (uma vez por worktree)…`)
  execFileSync('pnpm', ['migrate'], {
    cwd: dir,
    env: { ...process.env, DATABASE_URL: databaseUrl, PAYLOAD_SECRET: payloadSecret },
    stdio: 'inherit',
  })
}

/**
 * Runs the minimal synthetic seed on a provisioned database — the same
 * `pnpm db:seed:minimal` CI runs after `pnpm migrate`, so a worktree's dev and
 * test databases carry the same content CI's e2e asserts on (OPS28: worktrees
 * were migrate-only and the e2e diverged). Idempotent (upsert by stable key)
 * and guarded by the seed's own `assertLocalDatabase` — it never touches a
 * non-local database. Skipped alongside migrations by `--no-migrate`, since the
 * seed requires the migrated municipality catalog.
 */
const runSeedMinimal = (dir, databaseUrl, payloadSecret) => {
  console.log(`[worktree] ▶ seed mínimo em ${databaseUrl} (paridade com a CI)…`)
  execFileSync('pnpm', ['db:seed:minimal'], {
    cwd: dir,
    env: { ...process.env, DATABASE_URL: databaseUrl, PAYLOAD_SECRET: payloadSecret },
    stdio: 'inherit',
  })
}

/** Cursor Cloud / no-Docker fallback: shared teqo + teqo_test, no port override. */
const writeFallbackEnv = (dir, branch) => {
  const devEnv = [
    GENERATED_ENV_MARKER,
    '# fallback sem Docker (Cursor Cloud?): banco compartilhado, sem porta própria.',
    `# branch ${branch}`,
    'DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo',
    '',
  ].join('\n')
  const testEnv = [
    GENERATED_ENV_MARKER,
    '# fallback sem Docker (Cursor Cloud?): banco de teste compartilhado.',
    `# branch ${branch}`,
    'DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test',
    '',
  ].join('\n')
  writeFileSync(join(dir, '.env.local'), devEnv)
  writeFileSync(join(dir, '.env.test.local'), testEnv)
}
/**
 * Deterministic per-worktree environment: shared container + own databases +
 * own dev-server port + env files + migrations + minimal seed. Skips everything
 * when a manual `.env.local`/`.env.test.local` (no marker) exists — never
 * clobbers. `purpose` labels the env comment (`next` | `plan` | `new`); `issue`
 * is optional and fills the `issue #N` part of the comment only when present.
 */
const provision = async ({ dir, branch, issue, env, skipMigrate, mainRoot, purpose = 'next' }) => {
  const manual =
    (existsSync(join(dir, '.env.local')) && !envFileIsGenerated(dir, '.env.local')) ||
    (existsSync(join(dir, '.env.test.local')) && !envFileIsGenerated(dir, '.env.test.local'))
  if (manual) {
    console.warn(
      '[worktree] .env.local/.env.test.local manuais presentes — sem provisionar nem sobrescrever.',
    )
    console.warn(
      '[worktree] Remova os arquivos manuais e rode `pnpm worktree next` de novo para o ambiente isolado.',
    )
    return
  }

  const mainEnv = readMainEnv(mainRoot)
  const payloadSecret = mainEnv.PAYLOAD_SECRET ?? randomBytes(24).toString('hex')

  try {
    // Start (or reuse) the ONE shared Postgres container from any worktree dir.
    await startSharedPostgres({ cwd: dir })
  } catch (error) {
    console.warn('[worktree] Docker indisponível — usando o banco compartilhado (teqo/teqo_test).')
    console.warn(`[worktree] (${error.message.split('\n')[0]})`)
    writeFallbackEnv(dir, branch)
    // OPS28 — parity with CI even on the degraded shared databases: migrate +
    // seed the shared teqo/teqo_test so a Cloud worktree's e2e runs against the
    // same content CI asserts on. Both are idempotent and local-only, though
    // two CONCURRENT fallback provisionings can race the migrate/upserts — the
    // loser dies loudly and a re-run converges (degraded mode; not lock-guarded).
    if (!skipMigrate) {
      console.warn(
        '[worktree] atenção: o seed re-pina campaignGoals e 5 municípios no teqo/teqo_test ' +
          'compartilhados (valores ajustados manualmente no banco compartilhado serão sobrescritos).',
      )
      ensureWorktreeDeps(dir)
      runMigrate(dir, 'postgresql://teqo:teqo@localhost:5432/teqo', payloadSecret)
      runSeedMinimal(dir, 'postgresql://teqo:teqo@localhost:5432/teqo', payloadSecret)
      runMigrate(dir, 'postgresql://teqo:teqo@localhost:5432/teqo_test', payloadSecret)
      runSeedMinimal(dir, 'postgresql://teqo:teqo@localhost:5432/teqo_test', payloadSecret)
    } else {
      console.log('[worktree] --no-migrate: migrations e seed mínimo ficam para depois.')
    }
    return
  }

  const devDatabase = env.devDatabase
  const testDatabase = env.testDatabase
  await ensureDatabases([devDatabase, testDatabase])

  const devUrl = `postgresql://teqo:teqo@localhost:5432/${devDatabase}`
  const testUrl = `postgresql://teqo:teqo@localhost:5432/${testDatabase}`

  const copy = (key) => (mainEnv[key] ? [`${key}=${mainEnv[key]}`] : [])

  const issueLabel = issue ? ` · issue #${issue.number}` : ''
  const generatedBy = `gerado por pnpm worktree ${purpose}`

  const { dev: devLines, test: testLines } = worktreeEnvFileContents({
    branch,
    issueLabel,
    generatedBy,
    env,
    payloadSecret,
    copiedLines: [
      ...copy('BLOB_READ_WRITE_TOKEN'),
      ...copy('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
      ...copy('VAPID_PUBLIC_KEY'),
      ...copy('VAPID_PRIVATE_KEY'),
      ...copy('VAPID_SUBJECT'),
      ...copy('RESEND_API_KEY'),
      ...copy('CAMPAIGN_EMAIL_FROM'),
      ...copy('CAMPAIGN_EMAIL_FROM_NAME'),
    ],
  })
  writeFileSync(join(dir, '.env.local'), devLines.join('\n'))
  console.log(`[worktree] .env.local escrito (porta ${env.devPort}).`)
  writeFileSync(join(dir, '.env.test.local'), testLines.join('\n'))
  console.log('[worktree] .env.test.local escrito.')

  if (skipMigrate) {
    console.log('[worktree] --no-migrate: migrations e seed mínimo ficam para depois.')
    return
  }
  ensureWorktreeDeps(dir)
  runMigrate(dir, devUrl, payloadSecret)
  runSeedMinimal(dir, devUrl, payloadSecret)
  runMigrate(dir, testUrl, payloadSecret)
  runSeedMinimal(dir, testUrl, payloadSecret)
}

/**
 * Pick determinístico do `next` — READ-ONLY no GitHub: `--issue <N>` escolhe a
 * Issue direcionada (via `claimTargetVerdict`: `ready` → claim, `in-progress` →
 * reopen sem re-claim), sem a flag escolhe a próxima da fila (mesmo pick/ordem
 * do `pnpm agent:claim`). O claim em si acontece só em `cmdNext`, DEPOIS da
 * derivação/validação do branch — uma Issue sem frontmatter id (ou branch
 * inválido) morre antes do flip de labels, nunca deixando claim órfão.
 */
const pickNextIssue = ({ requestedIssueNumber, die }) => {
  if (requestedIssueNumber !== null) {
    const raw = String(requestedIssueNumber)
    const number = Number(raw)
    if (!Number.isInteger(number) || number <= 0) {
      die(`--issue inválido: ${raw}`)
    }
    const target = ghJson([
      'issue',
      'view',
      raw,
      '--json',
      'number,title,body,labels,createdAt,state',
    ])
    const verdict = claimTargetVerdict(target)
    if (verdict.kind === 'error') die(verdict.message)
    const entry = claimQueueEntry(target, issuesById())
    if (verdict.kind === 'reopen') {
      // Sessão já claimada — reabrir não re-claima (reopen é sobre a sessão,
      // nunca sobre a fila: deps atuais não importam).
      return { entry, reopened: true, directed: true }
    }
    if (entry.blockedBy.length > 0) {
      die(`Issue #${number} não é claimável (bloqueada por ${entry.blockedBy.join(', ')}).`)
    }
    return { entry, reopened: false, directed: true }
  }

  const pick = nextClaimableIssue()
  if (!pick) {
    die('Fila vazia — nada `ready` desbloqueado. Rode `pnpm agent:status` para ver a fila.')
  }
  return { entry: pick, reopened: false, directed: false }
}

const cmdNext = async (stay, skipMigrate, requestedIssueNumber) => {
  const { entry, reopened, directed } = pickNextIssue({ requestedIssueNumber, die })

  const issue = entry.issue
  const branch = branchNameForIssue({ ...issue, meta: entry.meta })
  if (git(['check-ref-format', '--allow-onelevel', branch], { okIfFails: true }) === null) {
    die(`Branch derivado inválido para refname: ${branch}`)
  }
  const dir = join(WORKTREES_ROOT, branch)

  // O claim flips labels — só depois da derivação do branch provar que a Issue
  // tem tudo para virar worktree.
  if (!reopened) claimIssue(entry, die)
  const claimedIssueNumber = reopened ? null : issue.number

  const headline = reopened
    ? 'Sessão já claimada — reabrindo (sem re-claim)'
    : directed
      ? 'Claimado (direcionado — `--issue`)'
      : 'Claimado da fila'
  console.log(`\n${headline}: #${issue.number} ${issue.title}`)
  for (const line of claimBriefLines(entry)) console.log(line)

  try {
    git(['fetch', 'origin'])

    const entries = parseWorktreeList(git(['worktree', 'list', '--porcelain']))
    if (entries.some((entry) => resolve(entry.path) === resolve(dir))) {
      console.log(`Worktree já existe em ${dir} — reutilizando, sem duplicar.`)
    } else {
      const branchExists =
        git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
          okIfFails: true,
        }) !== null
      if (branchExists) {
        // Reopen com worktree removido à mão: `-B` resetaria commits de sessão.
        const ahead = git(['log', '--oneline', `origin/main..${branch}`], { okIfFails: true })
        if (ahead) {
          die(
            `Branch ${branch} tem commits fora de origin/main e o worktree não existe — reabrir com -B descartaria esses commits. Rode \`git branch -D ${branch}\` (sessão encerrada) ou resolva antes.`,
          )
        }
      }
      const flag = branchExists ? '-B' : '-b'
      git(['worktree', 'add', flag, branch, dir, 'origin/main'])

      console.log('Worktree criado:')
      console.log(`  branch: ${branch}`)
      console.log(`  path:   ${dir}`)
      console.log('  origem: origin/main')
    }
    console.log(
      reopened
        ? 'Issue já claimada (sessão reaberta) — NÃO rodar `pnpm agent:claim` (o claim é parte do `worktree next`).'
        : 'Issue claimada por este comando — NÃO rodar `pnpm agent:claim` (o claim é parte do `worktree next`).',
    )

    const mainRoot = entries[0]?.path
    const env = worktreeEnvironment({
      branch,
      code: entry.meta.id,
      takenSlots: readLiveSlots(entries, dir),
    })
    await provision({ dir, branch, issue, env, skipMigrate, mainRoot })

    console.log(`\nAmbiente isolado do worktree (slot ${env.slot}):`)
    console.log(`  dev server: http://localhost:${env.devPort}   (pnpm dev)`)
    console.log(`  banco dev:  postgresql://teqo:teqo@localhost:5432/${env.devDatabase}`)
    console.log(`  banco test: postgresql://teqo:teqo@localhost:5432/${env.testDatabase}`)
  } catch (error) {
    if (claimedIssueNumber !== null) {
      console.error(
        `\n[worktree] Issue #${claimedIssueNumber} ficou claimada (o worktree não foi concluído) — ` +
          `reabra quando quiser: \`pnpm worktree next --issue ${claimedIssueNumber}\`.\n`,
      )
    }
    throw error
  }

  if (!stay) {
    printLaunchDirective({ dir, purpose: 'next', issueNumber: issue.number })
    console.log(`cd ${dir}`)
  }
}

/** Branch short-names already alive — local refs plus origin (shortened). */
const buildTakenBranchNames = () => {
  const taken = new Set()
  for (const scope of [
    (
      git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], {
        okIfFails: true,
      }) ?? ''
    ).split('\n'),
    (
      git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin'], {
        okIfFails: true,
      }) ?? ''
    )
      .split('\n')
      .map((name) => name.replace(/^origin\//, '')),
  ]) {
    for (const name of scope) if (name) taken.add(name)
  }
  return taken
}

/**
 * Shared runner for namespace worktrees NOT tied to the claim queue (`plan`
 * and `new`): fetches origin, picks a FRESH branch in the namespace (via
 * `branchName`), provisions the same isolated env as `next` (with `purpose`)
 * and prints the `cd <dir>` line by default (`--stay` suppresses). Every
 * invocation creates a DIFFERENT worktree — parallel sessions never share one.
 */
const cmdNamespaceBranch = async ({
  stay,
  skipMigrate,
  purpose,
  noun,
  sessionLabel,
  branchName,
}) => {
  git(['fetch', 'origin'])

  const entries = parseWorktreeList(git(['worktree', 'list', '--porcelain']))
  const taken = buildTakenBranchNames()

  const branch = branchName(taken)
  if (git(['check-ref-format', '--allow-onelevel', branch], { okIfFails: true }) === null) {
    die(`Branch ${purpose} inválido para refname: ${branch}`)
  }
  const dir = join(WORKTREES_ROOT, branch)

  if (entries.some((entry) => resolve(entry.path) === resolve(dir))) {
    die(
      `Já existe um worktree ${noun} em ${dir} (branch ${branch} não detectado nos refs). Rode \`pnpm worktree kill\` de dentro dele.`,
    )
  }

  git(['worktree', 'add', '-b', branch, dir, 'origin/main'])

  console.log(`Worktree ${noun} criado:`)
  console.log(`  sessão: ${sessionLabel}`)
  console.log(`  branch: ${branch}`)
  console.log(`  path:   ${dir}`)
  console.log('  origem: origin/main')

  const mainRoot = entries[0]?.path
  const env = worktreeEnvironment({
    branch,
    code: null,
    takenSlots: readLiveSlots(entries, dir),
  })
  await provision({ dir, branch, env, skipMigrate, mainRoot, purpose })

  console.log(`\nAmbiente isolado do worktree ${noun} (slot ${env.slot}):`)
  console.log(`  dev server: http://localhost:${env.devPort}   (pnpm dev)`)
  console.log(`  banco dev:  postgresql://teqo:teqo@localhost:5432/${env.devDatabase}`)
  console.log(`  banco test: postgresql://teqo:teqo@localhost:5432/${env.testDatabase}`)

  if (!stay) {
    printLaunchDirective({ dir, purpose })
    console.log(`cd ${dir}`)
  }
}

/**
 * `plan` — a `/plan-issue` planning worktree. Deliberately NOT tied to the
 * claim queue and NOT named after any Issue: the branch is derived either from
 * an optional `bag` slug (`plans/plan-issue-<bag>`, suffixed `-2`, `-3`, … on
 * collision) or from the next free sequential `plans/plan-issue-<n>`, so a
 * later `pnpm worktree next` for the next claimable Issue never collides with
 * it (branch name nor slot — each plan env registers its hashed slot via the
 * marker and `next` bumps around it). Same isolated env provisioning as
 * `next`.
 */
const cmdPlan = async (stay, skipMigrate, bag) =>
  cmdNamespaceBranch({
    stay,
    skipMigrate,
    purpose: 'plan',
    noun: 'de planejamento',
    sessionLabel: bag && bag.trim() ? `lote "${bag}"` : 'sequencial',
    branchName: (taken) => planBranchName({ bag, taken }),
  })

/**
 * `new` — a NEUTRAL worktree with no pre-defined function (explore an idea,
 * chat, or plan without registering anything). Deliberately NOT tied to the
 * claim queue nor to `/plan-issue`: with `bag`, branch `work/<bag>` (suffixed
 * `-2`, `-3`, … on collision); without, the next free sequential `work/<n>`.
 * The lowercase `work/…` prefix can never collide with a `next` branch
 * (uppercase-led `<code>-<slug>`) nor with a `plan` branch (`plans/…`), in
 * branch name or slot space. Same isolated env provisioning as `plan`.
 */
const cmdNew = async (stay, skipMigrate, bag) =>
  cmdNamespaceBranch({
    stay,
    skipMigrate,
    purpose: 'new',
    noun: 'neutro',
    sessionLabel: bag && bag.trim() ? `bag "${bag}"` : 'sequencial',
    branchName: (taken) => workBranchName({ bag, taken }),
  })

/** Generated database names referenced by a worktree's own env files. */
const worktreeDatabaseNamesOf = (dir) => {
  const names = []
  for (const file of ['.env.local', '.env.test.local']) {
    try {
      const text = readFileSync(join(dir, file), 'utf8')
      if (!text.includes(GENERATED_ENV_MARKER)) continue
      for (const line of text.split('\n')) {
        const match = /^DATABASE_URL=postgresql:\/\/[^/]+\/([a-z0-9_]+)$/.exec(line.trim())
        if (match && isGeneratedDatabaseName(match[1])) names.push(match[1])
      }
    } catch {
      // no env file — nothing to clean
    }
  }
  return [...new Set(names)]
}

/** Best-effort DROP DATABASE (WITH FORCE) of the destroyed worktree's DBs. */
const dropWorktreeDatabases = async (names) => {
  if (names.length === 0) return
  try {
    const client = new pg.Client({
      connectionString: MAINTENANCE_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    })
    await client.connect()
    try {
      for (const name of names) {
        await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
        console.log(`[worktree] banco removido: ${name}`)
      }
    } finally {
      await client.end().catch(() => {})
    }
  } catch (error) {
    console.warn(`[worktree] não consegui remover os bancos ${names.join(', ')}: ${error.message}`)
    console.warn('[worktree] remova manualmente: docker exec teqo-postgres-1 dropdb -U teqo <nome>')
  }
}

const cmdKill = async (force) => {
  const entries = parseWorktreeList(git(['worktree', 'list', '--porcelain']))
  const mainRoot = entries[0]?.path
  if (!mainRoot) die('Não consegui ler os worktrees deste repo.')
  const top = git(['rev-parse', '--show-toplevel'])
  if (resolve(top) === resolve(mainRoot)) {
    die(
      'Você está no worktree principal (main) — não dá para destruí-lo. Rode `git worktree list`.',
    )
  }

  const entry = entries.find((candidate) => resolve(candidate.path) === resolve(top))
  const branch = entry?.branch ?? null

  const dirty = git(['-C', top, 'status', '--porcelain'])
  if (dirty && !force) {
    const sample = dirty
      .split('\n')
      .slice(0, 10)
      .map((line) => `    ${line}`)
      .join('\n')
    die(
      `Worktree ${top} está sujo. Commite/stacke ou confirme com \`pnpm worktree kill --force\`.\n${sample}`,
    )
  }

  // Read the generated DB names BEFORE the directory is removed.
  const databaseNames = worktreeDatabaseNamesOf(top)

  git(['-C', mainRoot, 'worktree', 'remove', '--force', top])
  if (branch) git(['-C', mainRoot, 'branch', '-D', branch])

  console.log(`Worktree destruído: ${top}`)
  console.log(`  branch removido: ${branch ?? '(detached — nada a remover)'}`)

  await dropWorktreeDatabases(databaseNames)

  console.log(`cd ${mainRoot}`)
}

const { flags, positional } = parseArgs(process.argv.slice(2), new Set(['issue']))
const subcommand = positional[0]

if (!subcommand) {
  console.log(
    'Uso: pnpm worktree next [--issue N] [--stay] [--no-migrate] | plan [bag] [--stay] [--no-migrate] | new [bag] [--stay] [--no-migrate] | kill [--force]',
  )
  console.log('  next [--issue N] [--stay] [--no-migrate]')
  console.log('    CLAIMA a próxima Issue claimável (mesma fila/ordem e lock otimista do')
  console.log('    `pnpm agent:claim`) e cria o worktree dela (branch <code>-<slug>),')
  console.log('    provisionando o ambiente isolado: porta de dev + bancos próprios;')
  console.log('    claim falhou → motivo e saída sem worktree. `--issue N` claima a Issue')
  console.log('    direcionada (`ready`) ou REABRE uma já claimada (`in-progress`, sem')
  console.log('    re-claim). Por padrão imprime `cd <dir>` no fim (quem aplica o cd:')
  console.log('    opencode command, ou a função `worktree()` de .agents/shell/worktree.sh);')
  console.log('    no terminal (TEQO_WORKTREE_TERMINAL=1) imprime também a diretiva')
  console.log('    `launch opencode … --prompt "/work-issue --issue <N>"` (OPS26+OPS33:')
  console.log('    abre o TUI com deepseek/deepseek-v4-flash + auto + a Issue claimada já')
  console.log('    informada); --stay suprime cd e launch (o claim ainda acontece); --go')
  console.log('    explícito continua aceito como no-op; --no-migrate pula migrations e o')
  console.log('    seed mínimo (db:seed:minimal) nos bancos novos (OPS28: paridade com a CI)')
  console.log(`\n  plan [bag] [--stay] [--no-migrate]`)
  console.log(
    '    cria um worktree de planejamento DIFERENTE a cada invocação (sessões /plan-issue',
  )
  console.log('    paralelas): com bag, branch plans/plan-issue-<bag> (sufixo -2/-3 se o nome já')
  console.log('    existir); sem bag, o próximo plans/plan-issue-<n> sequencial livre; o prefixo')
  console.log(
    '    minúsculo plans/… nunca colide com o branch <code>-<slug> de `next`; no terminal,',
  )
  console.log(
    '    mesma diretiva `launch` com --prompt /plan-issue enviado (abre no fluxo de planejamento, sem digitação)',
  )
  console.log(`\n  new [bag] [--stay] [--no-migrate]`)
  console.log('    cria um worktree NEUTRO (sem função pré-definida) DIFERENTE a cada invocação:')
  console.log('    com bag, branch work/<bag> (sufixo -2/-3 se o nome já existir); sem bag, o')
  console.log('    próximo work/<n> sequencial livre; o prefixo minúsculo work/… nunca colide com')
  console.log('    o branch <code>-<slug> de `next` nem com plans/plan-issue-… de `plan`; no')
  console.log('    terminal, mesma diretiva `launch` porém sem --prompt (apenas conversar)')
  console.log('  kill [--force]  destrói o worktree em que você está (recusa sujo sem --force),')
  console.log('                  remove os bancos gerados do worktree (best-effort) e imprime')
  console.log('                  `cd <main>` no fim — o shell sempre volta ao worktree principal')
  process.exit(1)
}

try {
  if (subcommand === 'next') {
    if ('issue' in flags && flags.issue === undefined) {
      die('`--issue` requer um número (ex.: `--issue 595`).')
    }
    if (positional.length > 1) {
      die('`next` não aceita argumento posicional — use `--issue <N>` para direcionar a Issue.')
    }
    await cmdNext(Boolean(flags.stay), Boolean(flags['no-migrate']), flags.issue ?? null)
  } else if (subcommand === 'plan')
    await cmdPlan(Boolean(flags.stay), Boolean(flags['no-migrate']), positional[1])
  else if (subcommand === 'new')
    await cmdNew(Boolean(flags.stay), Boolean(flags['no-migrate']), positional[1])
  else if (subcommand === 'kill') {
    if (flags.stay) die('`--stay` não se aplica a `kill` — ele sempre volta ao main.')
    await cmdKill(Boolean(flags.force))
  } else die(`subcomando desconhecido: ${subcommand} (esperado: next | plan | new | kill)`)
} catch (error) {
  if (error?.stderr) die(error.stderr.toString().trim())
  die(error?.message ?? String(error))
}
