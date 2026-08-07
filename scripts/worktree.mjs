/**
 * `pnpm worktree` — worktree management determinístico em torno da fila de
 * claim do projeto (mesma fila de `agent:claim` / agent pool).
 *
 *   pnpm worktree next [--go]      cria worktree a partir de origin/main para a
 *                                  próxima Issue claimável; branch `<code>-<slug>`.
 *                                  Com `--go`, imprime `cd <dir>` no fim para o
 *                                  shell chamador aplicar (node não muda o cwd
 *                                  do shell pai; no terminal: `eval "$(pnpm
 *                                  worktree next --go)"`).
 *   pnpm worktree kill [--force]   destrói o worktree em que o shell atual está
 *                                  (recusa worktree sujo sem `--force`)
 *
 * Read-only no GitHub: `next` NUNCA claima (claim = `pnpm agent:claim`).
 * Dir raiz: `~/.cursor/worktrees/teqo/` (mesma casa dos worktrees do Cursor).
 */

import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { dieAgent, nextClaimableIssue, parseArgs } from './lib/agent-github.mjs'
import { branchNameForIssue } from './lib/worktree.mjs'

const die = dieAgent('worktree')
const WORKTREES_ROOT = join(homedir(), '.cursor', 'worktrees', 'teqo')

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

const cmdNext = (go) => {
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

  if (go) console.log(`cd ${dir}`)
}

const cmdKill = (force) => {
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

  git(['-C', mainRoot, 'worktree', 'remove', '--force', top])
  if (branch) git(['-C', mainRoot, 'branch', '-D', branch])

  console.log(`Worktree destruído: ${top}`)
  console.log(`  branch removido: ${branch ?? '(detached — nada a remover)'}`)
  console.log(`Volte ao main: cd ${mainRoot}`)
}

const { flags, positional } = parseArgs(process.argv.slice(2), new Set())
const subcommand = positional[0]

if (!subcommand) {
  console.log('Uso: pnpm worktree next [--go] | kill [--force]')
  console.log('  next [--go]     cria worktree da próxima Issue claimável (branch <code>-<slug>);')
  console.log('                  com --go imprime `cd <dir>` no fim para o shell chamador aplicar')
  console.log('  kill [--force]  destrói o worktree em que você está (recusa sujo sem --force)')
  process.exit(1)
}

try {
  if (subcommand === 'next') cmdNext(Boolean(flags.go))
  else if (subcommand === 'kill') {
    if (flags.go) die('`--go` só faz sentido com `next`.')
    cmdKill(Boolean(flags.force))
  } else die(`subcomando desconhecido: ${subcommand} (esperado: next | kill)`)
} catch (error) {
  if (error?.stderr) die(error.stderr.toString().trim())
  die(error?.message ?? String(error))
}
