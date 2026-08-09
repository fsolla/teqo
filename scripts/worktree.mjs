/**
 * `pnpm worktree` — worktree management determinístico em torno da fila de
 * claim do projeto (mesma fila de `agent:claim` / agent pool).
 *
 *   pnpm worktree next [--go] [--no-migrate]
 *                              cria worktree a partir de origin/main para a
 *                              próxima Issue claimável; branch `<code>-<slug>`.
 *                              Com `--go`, imprime `cd <dir>` no fim — node
 *                              não muda o cwd do shell pai; o shell chamador
 *                              aplica (opencode/CDP usa o opencode command;
 *                              terminal interativo: função `worktree()` em
 *                              `.agents/shell/worktree.sh`, sourced no profile).
 *                              Também PROVISIONA o ambiente isolado do worktree:
 *                              porta do dev server + bancos próprios derivados
 *                              deterministicamente do branch (ver
 *                              scripts/lib/worktree-env.mjs), para agentes em
 *                              paralelo não disputarem porta 3000 nem o
 *                              `teqo_test` compartilhado. `--no-migrate` pula a
 *                              aplicação das migrations nos bancos novos.
 *   pnpm worktree plan [bag] [--go] [--no-migrate]
 *                              cria um worktree de PLANEJAMENTO novo para rodar
 *                              a skill /plan-issue sem ocupar o main — cada
 *                              invocação cria UM DIFERENTE, para sessões de
 *                              planejamento paralelas: com `bag`, branch
 *                              `plans/plan-issue-<bag>` (e `-2`, `-3`, … se o
 *                              nome já estiver vivo); sem `bag`, o próximo
 *                              sequencial `plans/plan-issue-<n>` livre. Nenhum
 *                              deles (branch nem slot) colide com um `next`
 *                              posterior (prefixo minúsculo `plans/…`).
 *                              Mesmo provisionamento isolado do `next`.
 *   pnpm worktree kill [--force]   destrói o worktree em que o shell atual está
 *                              (recusa worktree sujo sem `--force`) e remove os
 *                              bancos gerados do worktree (best-effort)
 *
 * Read-only no GitHub: `next` NUNCA claima (claim = `pnpm agent:claim`).
 * Dir raiz: `~/.cursor/worktrees/teqo/` (mesma casa dos worktrees do Cursor).
 */

import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { parse as parseEnv } from 'dotenv'
import pg from 'pg'

import { dieAgent, nextClaimableIssue, parseArgs } from './lib/agent-github.mjs'
import {
  DEV_PORT_BASE,
  GENERATED_ENV_MARKER,
  isGeneratedDatabaseName,
  worktreeEnvFileContents,
  worktreeEnvironment,
} from './lib/worktree-env.mjs'
import { branchNameForIssue, planBranchName } from './lib/worktree.mjs'

const die = dieAgent('worktree')
const WORKTREES_ROOT = join(homedir(), '.cursor', 'worktrees', 'teqo')

/** Fixed compose project so `db:start`/provisioning always target ONE container. */
const SHARED_COMPOSE_PROJECT = 'teqo'
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

/** Start (or reuse) the ONE shared Postgres container from any worktree dir. */
const dockerComposeUp = (dir) => {
  execFileSync(
    'docker',
    ['compose', '-p', SHARED_COMPOSE_PROJECT, 'up', '-d', '--wait', 'postgres'],
    { cwd: dir, stdio: 'inherit' },
  )
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
 * own dev-server port + env files + migrations. Skips everything when a
 * manual `.env.local`/`.env.test.local` (no marker) exists — never clobbers.
 * `purpose` labels the env comment (`next` | `plan`); `issue` is optional and
 * fills the `issue #N` part of the comment only when present.
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

  try {
    dockerComposeUp(dir)
  } catch (error) {
    console.warn('[worktree] Docker indisponível — usando o banco compartilhado (teqo/teqo_test).')
    console.warn(`[worktree] (${error.message.split('\n')[0]})`)
    writeFallbackEnv(dir, branch)
    return
  }

  const devDatabase = env.devDatabase
  const testDatabase = env.testDatabase
  await ensureDatabases([devDatabase, testDatabase])

  const mainEnv = readMainEnv(mainRoot)
  const payloadSecret = mainEnv.PAYLOAD_SECRET ?? randomBytes(24).toString('hex')
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
    console.log('[worktree] --no-migrate: migrations ficam para depois (pnpm migrate).')
    return
  }
  ensureWorktreeDeps(dir)
  runMigrate(dir, devUrl, payloadSecret)
  runMigrate(dir, testUrl, payloadSecret)
}

const cmdNext = async (go, skipMigrate) => {
  const pick = nextClaimableIssue()
  if (!pick) {
    die('Fila vazia — nada `ready` desbloqueado. Rode `pnpm agent:status` para ver a fila.')
  }

  const issue = pick.issue
  const branch = branchNameForIssue({ ...issue, meta: pick.meta })
  if (git(['check-ref-format', '--allow-onelevel', branch], { okIfFails: true }) === null) {
    die(`Branch derivado inválido para refname: ${branch}`)
  }
  const dir = join(WORKTREES_ROOT, branch)

  console.log(`Próxima da fila: #${issue.number} ${issue.title}`)

  git(['fetch', 'origin'])

  const entries = parseWorktreeList(git(['worktree', 'list', '--porcelain']))
  if (entries.some((entry) => resolve(entry.path) === resolve(dir))) {
    console.log(`Worktree já existe em ${dir} — reutilizando, sem duplicar.`)
  } else {
    const branchExists =
      git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { okIfFails: true }) !== null
    const flag = branchExists ? '-B' : '-b'
    git(['worktree', 'add', flag, branch, dir, 'origin/main'])

    console.log('Worktree criado:')
    console.log(`  branch: ${branch}`)
    console.log(`  path:   ${dir}`)
    console.log('  origem: origin/main')
    console.log('Issue NÃO claimada — claim continua sendo `pnpm agent:claim`.')
  }

  const mainRoot = entries[0]?.path
  const env = worktreeEnvironment({
    branch,
    code: pick.meta.id,
    takenSlots: readLiveSlots(entries, dir),
  })
  await provision({ dir, branch, issue, env, skipMigrate, mainRoot })

  console.log(`\nAmbiente isolado do worktree (slot ${env.slot}):`)
  console.log(`  dev server: http://localhost:${env.devPort}   (pnpm dev)`)
  console.log(`  banco dev:  postgresql://teqo:teqo@localhost:5432/${env.devDatabase}`)
  console.log(`  banco test: postgresql://teqo:teqo@localhost:5432/${env.testDatabase}`)

  if (go) console.log(`cd ${dir}`)
}

/**
 * `plan` — a `/plan-issue` planning worktree. Deliberately NOT tied to the
 * claim queue and NOT named after any Issue: the branch is derived either from
 * an optional `bag` slug (`plans/plan-issue-<bag>`, suffixed `-2`, `-3`, … on
 * collision) or from the next free sequential `plans/plan-issue-<n>`, so a
 * later `pnpm worktree next` for the next claimable Issue never collides with
 * it (branch name nor slot — each plan env registers its hashed slot via the
 * marker and `next` bumps around it). Every invocation creates a DIFFERENT
 * worktree — parallel `/plan-issue` sessions never share one. Same isolated
 * env provisioning as `next`.
 */
const cmdPlan = async (go, skipMigrate, bag) => {
  git(['fetch', 'origin'])

  const entries = parseWorktreeList(git(['worktree', 'list', '--porcelain']))

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

  const branch = planBranchName({ bag, taken })
  if (git(['check-ref-format', '--allow-onelevel', branch], { okIfFails: true }) === null) {
    die(`Branch plan inválido para refname: ${branch}`)
  }
  const dir = join(WORKTREES_ROOT, branch)

  if (entries.some((entry) => resolve(entry.path) === resolve(dir))) {
    die(
      `Já existe um worktree de planejamento em ${dir} (branch ${branch} não detectado nos refs). Rode \`pnpm worktree kill\` de dentro dele.`,
    )
  }

  const label = bag && bag.trim() ? `lote "${bag}"` : 'sequencial'
  git(['worktree', 'add', '-b', branch, dir, 'origin/main'])

  console.log('Worktree de planejamento criado:')
  console.log(`  sessão: ${label}`)
  console.log(`  branch: ${branch}`)
  console.log(`  path:   ${dir}`)
  console.log('  origem: origin/main')

  const mainRoot = entries[0]?.path
  const env = worktreeEnvironment({
    branch,
    code: null,
    takenSlots: readLiveSlots(entries, dir),
  })
  await provision({ dir, branch, env, skipMigrate, mainRoot, purpose: 'plan' })

  console.log(`\nAmbiente isolado do worktree de planejamento (slot ${env.slot}):`)
  console.log(`  dev server: http://localhost:${env.devPort}   (pnpm dev)`)
  console.log(`  banco dev:  postgresql://teqo:teqo@localhost:5432/${env.devDatabase}`)
  console.log(`  banco test: postgresql://teqo:teqo@localhost:5432/${env.testDatabase}`)

  if (go) console.log(`cd ${dir}`)
}

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
  console.log(`Volte ao main: cd ${mainRoot}`)

  await dropWorktreeDatabases(databaseNames)
}

const { flags, positional } = parseArgs(process.argv.slice(2), new Set())
const subcommand = positional[0]

if (!subcommand) {
  console.log(
    'Uso: pnpm worktree next [--go] [--no-migrate] | plan [bag] [--go] [--no-migrate] | kill [--force]',
  )
  console.log('  next [--go] [--no-migrate]')
  console.log('    cria worktree da próxima Issue claimável (branch <code>-<slug>) e provisiona o')
  console.log('    ambiente isolado: porta de dev + bancos próprios (determinístico do branch);')
  console.log('    com --go imprime `cd <dir>` no fim (quem aplica o cd: opencode command, ou a')
  console.log('    função `worktree()` de .agents/shell/worktree.sh); --no-migrate pula migrations')
  console.log(`\n  plan [bag] [--go] [--no-migrate]`)
  console.log(
    '    cria um worktree de planejamento DIFERENTE a cada invocação (sessões /plan-issue',
  )
  console.log('    paralelas): com bag, branch plans/plan-issue-<bag> (sufixo -2/-3 se o nome já')
  console.log('    existir); sem bag, o próximo plans/plan-issue-<n> sequencial livre; o prefixo')
  console.log('    minúsculo plans/… nunca colide com o branch <code>-<slug> de `next`')
  console.log('  kill [--force]  destrói o worktree em que você está (recusa sujo sem --force) e')
  console.log('                  remove os bancos gerados do worktree (best-effort)')
  process.exit(1)
}

try {
  if (subcommand === 'next') await cmdNext(Boolean(flags.go), Boolean(flags['no-migrate']))
  else if (subcommand === 'plan')
    await cmdPlan(Boolean(flags.go), Boolean(flags['no-migrate']), positional[1])
  else if (subcommand === 'kill') {
    if (flags.go) die('`--go` só faz sentido com `next`.')
    await cmdKill(Boolean(flags.force))
  } else die(`subcomando desconhecido: ${subcommand} (esperado: next | plan | kill)`)
} catch (error) {
  if (error?.stderr) die(error.stderr.toString().trim())
  die(error?.message ?? String(error))
}
