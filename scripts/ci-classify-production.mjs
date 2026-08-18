#!/usr/bin/env node
/**
 * ci-classify-production — OPS65 production-change gate for the main CI
 * window. Classifies whether the merge head differs from the deployed
 * artifact in anything that would enter the docker build context.
 *
 * The `.dockerignore` is the source of truth (the Dockerfile does `COPY . .`):
 * a changed path is production when it is NOT excluded by the ignore
 * patterns. The gate is FAIL-OPEN toward production: dispatch (explicit
 * operator intent) and an unknown deployed SHA always run the full suite;
 * a classification ERROR (git/.dockerignore unreadable, no input) prints
 * production=true AND exits 1, so the workflow run turns red — the suite
 * still runs (fail-open) but the deploy never happens silently. A green run
 * only ever means "the gate could classify and there is nothing to do".
 *
 * Plain Node, stdlib only — the gate must stay cheap (no pnpm install).
 *
 *   node scripts/ci-classify-production.mjs --deployed <sha> [--value]
 *   node scripts/ci-classify-production.mjs --files-from <file> [--value]
 *
 * Output: JSON { production, reason, changed, kept, skipped } on stdout
 * (`--value` prints only `true`/`false`). Exit 0 = classified; exit 1 =
 * could not classify (production=true printed, run should go red).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { isDockerignored, parseDockerignore } from './lib/dockerignore.mjs'

const parseArgs = (argv) => {
  const flags = {}
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--')) {
      const name = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())
      const next = argv[index + 1]
      flags[name] = typeof next === 'string' && !next.startsWith('--') ? next : true
      if (typeof next === 'string' && !next.startsWith('--')) index += 1
    }
  }
  return flags
}

const flags = parseArgs(process.argv)
const deployed = flags.deployed
const filesFrom = flags.filesFrom
const valueOnly = flags.value === true

/**
 * @param {string[]} changed - repo-relative changed paths
 * @param {import('./lib/dockerignore.mjs').DockerignoreRule[]} patterns -
 *   .dockerignore rules
 * @returns {{ production: boolean, kept: string[], skipped: string[] }}
 */
export function classifyProduction(changed, patterns) {
  const kept = []
  const skipped = []
  for (const path of changed) {
    if (path.length === 0) continue
    if (isDockerignored(path, patterns)) skipped.push(path)
    else kept.push(path)
  }
  return { production: kept.length > 0, kept, skipped }
}

const report = (production, reason, extra = {}) => {
  const result = { production, reason, ...extra }
  if (valueOnly) {
    console.log(production)
    return
  }
  console.log(JSON.stringify(result))
}

/**
 * Could not classify at all (git/.dockerignore unreadable, no input): run
 * the full pipeline AND make the run red — a gate that cannot classify must
 * never look like "nothing to do".
 */
const failOpenRed = (reason) => {
  report(true, reason, { changed: [], kept: [], skipped: [] })
  process.exitCode = 1
}

// Import-safe: the module is unit-tested (classifyProduction), so the CLI
// body only runs when executed as a script.
const isCli =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  main()
}

function main() {
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    report(true, 'workflow_dispatch (intenção explícita)')
    return
  }

  let changed
  try {
    if (filesFrom) {
      changed = readFileSync(filesFrom, 'utf8').split('\n').filter(Boolean)
    } else if (deployed === '') {
      // The workflow always passes --deployed (possibly empty: no container
      // revision on the homeserver). An empty deployed SHA is a legitimate
      // "unknown deployed state" — run the full pipeline, keep the run green.
      report(true, 'sem SHA deployado (estado desconhecido)', {
        changed: [],
        kept: [],
        skipped: [],
      })
      return
    } else if (deployed === true) {
      failOpenRed('--deployed sem valor')
      return
    } else if (deployed) {
      changed = execFileSync('git', ['diff', '--name-only', deployed, 'HEAD', '--'], {
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean)
    } else {
      failOpenRed('sem SHA deployado nem files-from')
      return
    }
  } catch (error) {
    failOpenRed(`erro ao obter o diff (${error instanceof Error ? error.message : error})`)
    return
  }

  if (changed.length === 0) {
    report(false, 'diff vazio (nada a fazer)', {
      changed: [],
      kept: [],
      skipped: [],
    })
    return
  }

  let rules
  try {
    rules = parseDockerignore(readFileSync('.dockerignore', 'utf8'))
  } catch (error) {
    failOpenRed(`.dockerignore ilegível (${error instanceof Error ? error.message : error})`)
    return
  }

  const classified = classifyProduction(changed, rules)
  report(
    classified.production,
    classified.production ? 'mudança de produção desde o último deploy' : 'sem mudança de produção',
    { changed, kept: classified.kept, skipped: classified.skipped },
  )
}
