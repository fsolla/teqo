/**
 * `pnpm agent:file-miss` — file an agent-miss issue (guardrail pipeline).
 *
 * Misses feed the progressive-guardrail harvest: each miss becomes an issue
 * with `kind:agent-miss`; periodically a human/agent harvests them into a
 * programmatic guardrail (codebaseConventions spec, ESLint rule, CI check).
 *
 *   pnpm agent:file-miss -- --title "migration merged sem atualizar seed:minimal" \
 *     [--body "contexto..."] [--kind agent-miss|defect]
 */

import { dieAgent, gh, parseArgs } from './lib/agent-github.mjs'

const die = dieAgent('file-miss')
const { flags } = parseArgs(process.argv.slice(2), new Set(['title', 'body', 'kind']))

if (!flags.title) {
  die(
    'Usage: pnpm agent:file-miss -- --title <what went wrong> [--body details] [--kind agent-miss|defect]',
  )
}

const kind = flags.kind === 'defect' ? 'defect' : 'agent-miss'
const body = [
  flags.body ?? '',
  '',
  '_Registrado por `pnpm agent:file-miss`. Harvest: avaliar guardrail programático (teste de convenção, ESLint, check de CI) e registrar em `docs/GUARDRAILS.md`._',
].join('\n')

const url = gh([
  'issue',
  'create',
  '--title',
  flags.title,
  '--body',
  body,
  '--label',
  `kind:${kind}`,
  '--label',
  'prio:P2',
])

console.log(`[agent:file-miss] filed ${url}`)
