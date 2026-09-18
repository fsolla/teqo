/**
 * Snapshot extractor for the theme/area dossiê (C190).
 *
 * Runs where production lives (homeserver), read-only by connection options,
 * and writes a JSON snapshot consumed by `scripts/build-dossie-solla-tema.mjs`.
 * Nothing is persisted.
 *
 * The token is resolved fail-closed against the canonical acervo taxonomy
 * (`SPEECH_TOPICS`); the taxonomy is closed, so there is no one-off escape —
 * an unknown token lists the 18 canonical areas and stops.
 *
 * Usage (from the homeserver, with `~/stack/teqo-1313.env` loaded):
 *   THEME_REPORT_CONFIRM=1 NODE_OPTIONS="--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs" \
 *     node scripts/extract-theme-snapshot.mjs --theme=educacao --out=data/dossie-solla-tema/educacao.theme.snapshot.json
 */

import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveSpeechTopic, SPEECH_TOPICS } from '../src/lib/speechFacets.ts'
import { databaseLabel } from './lib/cityReportDatabase.mjs'
import { dieWithLabel, loadCliEnv, parseEqualsFlags } from './lib/cli.mjs'
import { enterReadOnlySession, resolveCampaignActor } from './lib/readOnlyExtract.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LABEL = 'extract-theme-snapshot'
const die = dieWithLabel(LABEL)

const codeSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  } catch {
    return null
  }
}

/** Catalog listing used by the fail-closed error (value + label, one per line). */
const topicCatalog = () =>
  SPEECH_TOPICS.map(({ value, label }) => `  ${value} (${label})`).join('\n')

/**
 * Resolve the canonical area: value or pt-BR label, accent/case insensitive.
 * Unknown token fails closed with the full taxonomy — never an invented slug.
 */
const resolveIdentity = (token) => {
  const entry = resolveSpeechTopic(token)
  if (!entry) {
    die(
      `Área desconhecida na taxonomia do acervo: "${token}".\n` + `  Canônicas:\n${topicCatalog()}`,
    )
  }
  return {
    slug: entry.value,
    value: entry.value,
    label: entry.label,
    taxonomyNote: 'Taxonomia do acervo',
  }
}

loadCliEnv()

const { flags } = parseEqualsFlags(process.argv.slice(2))
const out = typeof flags.out === 'string' ? flags.out : null
const themeToken = typeof flags.theme === 'string' ? flags.theme.trim() : ''
if (!themeToken) {
  die(
    'Uso: --theme=<valor|label> --out=<arquivo.json>\n' +
      `  Áreas canônicas:\n${topicCatalog()}\n` +
      '  Env: THEME_REPORT_CONFIRM=1 (obrigatório), DATABASE_URL (read-only é forçado).',
  )
}
const identity = resolveIdentity(themeToken)

if (!out) {
  die('Uso: --theme=<valor|label> --out=<arquivo.json>.')
}

const rawDatabaseUrl = enterReadOnlySession({
  confirmEnv: 'THEME_REPORT_CONFIRM',
  label: LABEL,
  die,
  context: `área ${identity.value}`,
})

const { default: configPromise } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const { composeThemeSnapshot } = await import('./themeSnapshot.mjs')

const payload = await getPayload({ config: configPromise })

try {
  const actor = await resolveCampaignActor(payload, { die })
  console.log(`[${LABEL}] ator: ${actor.name ?? actor.id} (${actor.role})`)

  const snapshot = await composeThemeSnapshot({
    payload,
    actor,
    identity,
    readAt: new Date().toISOString(),
    codeSha: codeSha(),
    database: databaseLabel(rawDatabaseUrl),
  })

  const outPath = resolve(ROOT, out)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `[${LABEL}] snapshot de ${snapshot.theme.label} (${snapshot.theme.value}) → ${out} ` +
      `(falas=${snapshot.speeches.totalCount} lacunas=${snapshot.gaps.length})`,
  )
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
}

process.exit(0)
