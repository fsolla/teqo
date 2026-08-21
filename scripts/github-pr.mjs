/**
 * Plain-Node CLI (no pnpm) — create a GitHub PR (Ready, never draft) for
 * agent deliveries. Replaces the Forgejo MCP `create_pull_request` in the
 * delivery flow (OPS71: PRs live on GitHub; the tracker stays on Forgejo).
 *
 *   GITHUB_TOKEN=<PAT> node scripts/github-pr.mjs \
 *     --head <branch> --title "<título>" --body-file <path>
 *   GITHUB_TOKEN=<PAT> node scripts/github-pr.mjs --head <b> --title <t> --body "Closes #N"
 *
 * The repo rule "PRs are Ready, never draft" is structural: there is no
 * `--draft` flag. Base defaults to `main`.
 */

import { createApi } from './lib/github-api.mjs'

const parseArgs = (argv) => {
  const flags = {}
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      const next = argv[index + 1]
      flags[name] = typeof next === 'string' && !next.startsWith('--') ? next : true
      if (typeof next === 'string' && !next.startsWith('--')) index += 1
    }
  }
  return flags
}

const flags = parseArgs(process.argv)
const head = flags.head
const title = flags.title
const base = flags.base ?? 'main'

if (!head || !title) {
  console.error(
    'Usage: node scripts/github-pr.mjs --head <branch> --title <t> [--base main] --body "<text>" | --body-file <path>',
  )
  process.exit(1)
}

let body = flags.body
if (flags['body-file']) {
  try {
    const { readFileSync } = await import('node:fs')
    body = readFileSync(flags['body-file'], 'utf8')
  } catch (error) {
    console.error(`[github-pr] não consegui ler --body-file: ${error.message}`)
    process.exit(1)
  }
}
if (typeof body !== 'string' || body.length === 0) {
  console.error('[github-pr] body vazio — passe --body ou --body-file')
  process.exit(1)
}

const api = createApi({})
try {
  const pr = await api.createPullRequest({ head, base, title, body })
  console.log(`[github-pr] PR #${pr.number} criado (Ready): ${pr.htmlUrl}`)
} catch (error) {
  console.error(`[github-pr] falhou: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
