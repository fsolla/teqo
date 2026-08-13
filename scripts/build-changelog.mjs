#!/usr/bin/env node
/**
 * build-changelog — regenerate docs/CHANGELOG-AGENTS.md from the per-delivery
 * entries in docs/changelog/ (OPS44). Deliveries write one
 * `<date>-<id>.md` file and run `pnpm changelog:build`; the aggregate keeps
 * the single readable "Recently resolved" history. Insert-only: historical
 * blocks are never touched.
 *
 * Usage: node scripts/build-changelog.mjs [--check]
 *   --check   verify the aggregate is up to date without writing (CI use)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildChangelog,
  CHANGELOG_AGGREGATE,
  CHANGELOG_DIR,
  listChangelogEntries,
} from './lib/changelog.mjs'

const repoRoot = process.cwd()
const checkOnly = process.argv.includes('--check')

function die(message) {
  console.error(`[build-changelog] ${message}`)
  process.exit(1)
}

const aggregatePath = join(repoRoot, CHANGELOG_AGGREGATE)
const changelogDir = join(repoRoot, CHANGELOG_DIR)

let aggregateContent
try {
  aggregateContent = readFileSync(aggregatePath, 'utf8')
} catch {
  die(`não consegui ler ${CHANGELOG_AGGREGATE}`)
}

let files
try {
  files = readdirSync(changelogDir)
} catch {
  die(`não consegui ler ${CHANGELOG_DIR}/`)
}

const { entries, errors } = listChangelogEntries(files.map((name) => `${CHANGELOG_DIR}/${name}`))
if (errors.length > 0) {
  die(`entradas inválidas em ${CHANGELOG_DIR}/:\n  ${errors.join('\n  ')}`)
}

const bodies = entries.map(({ path }) => {
  try {
    return readFileSync(join(repoRoot, path), 'utf8')
  } catch {
    die(`não consegui ler ${path}`)
  }
})

const next = buildChangelog({
  entries: bodies.map((content) => ({ content })),
  aggregateContent,
})

if (checkOnly) {
  if (next !== aggregateContent) {
    die(`${CHANGELOG_AGGREGATE} desatualizado — rode \`pnpm changelog:build\``)
  }
  console.log('[build-changelog] ok — aggregate up to date')
  process.exit(0)
}

writeFileSync(aggregatePath, next)
console.log(`[build-changelog] regenerado ${CHANGELOG_AGGREGATE} com ${entries.length} entrada(s)`)
