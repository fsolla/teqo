#!/usr/bin/env node
/**
 * build-changelog — regenerate the aggregated changelog (OPS44/OPS85).
 *
 * docs/changelog/<date>-<id>.md is the only committed changelog record.
 * The readable aggregate docs/CHANGELOG-AGENTS.md is a gitignored artifact
 * generated on demand, seeded from the frozen snapshot
 * docs/CHANGELOG-AGENTS-HISTORY.md when the local file is absent. Insert-only:
 * historical blocks are never touched.
 *
 * Usage: node scripts/build-changelog.mjs [--stdout] [--check]
 *   --stdout  print the aggregate to stdout instead of writing the file
 *   --check   verify the local aggregate (when present) is up to date —
 *             local sanity only, not a CI/gate requirement since OPS85
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildChangelog,
  CHANGELOG_AGGREGATE,
  CHANGELOG_DIR,
  CHANGELOG_HEADER,
  CHANGELOG_HISTORY,
  listChangelogEntries,
  splitChangelogBody,
} from './lib/changelog.mjs'

const repoRoot = process.cwd()
const toStdout = process.argv.includes('--stdout')
const checkOnly = process.argv.includes('--check')

function die(message) {
  console.error(`[build-changelog] ${message}`)
  process.exit(1)
}

const aggregatePath = join(repoRoot, CHANGELOG_AGGREGATE)
const changelogDir = join(repoRoot, CHANGELOG_DIR)

let localContent = null
try {
  localContent = readFileSync(aggregatePath, 'utf8')
} catch {
  // absent — regenerable artifact; seed from the frozen HISTORY snapshot
}

let aggregateContent = localContent
if (aggregateContent === null) {
  let historyContent
  try {
    historyContent = readFileSync(join(repoRoot, CHANGELOG_HISTORY), 'utf8')
  } catch {
    die(`não consegui ler ${CHANGELOG_AGGREGATE} nem o seed ${CHANGELOG_HISTORY}`)
  }
  const { blocks } = splitChangelogBody(historyContent)
  aggregateContent = [CHANGELOG_HEADER, ...blocks].join('\n\n') + '\n'
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

const withContent = entries.map(({ path, name, date, id }) => {
  try {
    return { path, name, date, id, content: readFileSync(join(repoRoot, path), 'utf8') }
  } catch {
    die(`não consegui ler ${path}`)
  }
})

const next = buildChangelog({
  entries: withContent.map(({ content }) => ({ content })),
  aggregateContent,
})

// Post-condition (OPS85): no parsed entry may silently vanish from the
// generated aggregate — replaces the old committed-aggregate multiset.
for (const { path, content } of withContent) {
  if (!next.includes(content.trimEnd())) {
    die(`entrada ausente do agregado gerado (perda silenciosa?): ${path}`)
  }
}

if (checkOnly) {
  if (localContent === null) {
    console.log('[build-changelog] ok — agregado local ausente (artefato regenerável)')
    process.exit(0)
  }
  if (next !== localContent) {
    die(`${CHANGELOG_AGGREGATE} desatualizado — rode \`pnpm changelog:build\``)
  }
  console.log('[build-changelog] ok — aggregate up to date')
  process.exit(0)
}

if (toStdout) {
  process.stdout.write(next)
  process.exit(0)
}

writeFileSync(aggregatePath, next)
console.log(`[build-changelog] regenerado ${CHANGELOG_AGGREGATE} com ${entries.length} entrada(s)`)
