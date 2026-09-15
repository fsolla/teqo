/**
 * Snapshot extractor for the city report (C163).
 *
 * Runs where production lives (homeserver), read-only by connection options,
 * and writes a JSON snapshot consumed by `scripts/build-city-report.mjs`.
 * Nothing is persisted in the database and the script never writes to it.
 *
 * Usage (from the homeserver, with `~/stack/teqo-1313.env` loaded):
 *   CITY_REPORT_CONFIRM=1 NODE_OPTIONS="--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs" \
 *     node scripts/extract-city-report-snapshot.mjs --municipality=<slug> --out=data/relatorios-cidade/<slug>.snapshot.json
 */

import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  databaseLabel,
  READ_ONLY_PG_OPTIONS,
  withReadOnlyDatabaseUrl,
} from './lib/cityReportDatabase.mjs'
import {
  databaseHostname,
  dieWithLabel,
  isTruthyEnv,
  loadCliEnv,
  parseEqualsFlags,
} from './lib/cli.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'extract-city-report-snapshot'
const die = dieWithLabel(LABEL)

const codeSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  } catch {
    return null
  }
}

const resolveActor = async (payload) => {
  for (const role of ['candidate', 'coordinator']) {
    const result = await payload.find({
      collection: 'campaignUser',
      where: { role: { equals: role } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    const doc = result.docs[0]
    if (doc) return { ...doc, collection: 'campaignUser' }
  }
  die(
    'Nenhum campaignUser com papel candidate/coordinator encontrado — o relatório exige um ator real que enxergue tudo.',
  )
}

loadCliEnv()

const { flags } = parseEqualsFlags(process.argv.slice(2))
const slug = typeof flags.municipality === 'string' ? flags.municipality : null
const out = typeof flags.out === 'string' ? flags.out : null

if (!slug || !out) {
  die(
    'Uso: --municipality=<slug> --out=<arquivo.json>\n' +
      '  Env: CITY_REPORT_CONFIRM=1 (obrigatório), DATABASE_URL (read-only é forçado), PORTAL da vida real.',
  )
}
if (!isTruthyEnv(process.env.CITY_REPORT_CONFIRM)) {
  die(
    'Opt-in explícito ausente: rode com CITY_REPORT_CONFIRM=1.\n' +
      `  Alvo: ${databaseHostname(process.env.DATABASE_URL) ?? 'DATABASE_URL ausente'} — a leitura é read-only, mas o comando não adivinha o alvo.`,
  )
}

const rawDatabaseUrl = process.env.DATABASE_URL
process.env.DATABASE_URL = withReadOnlyDatabaseUrl(rawDatabaseUrl, READ_ONLY_PG_OPTIONS)
console.log(
  `[${LABEL}] alvo ${databaseLabel(rawDatabaseUrl)} · sessão read-only · município ${slug}`,
)

const { default: configPromise } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const { composeCityReportSnapshot } = await import('./cityReportSnapshot.mjs')

const payload = await getPayload({ config: configPromise })

try {
  const actor = await resolveActor(payload)
  console.log(`[${LABEL}] ator: ${actor.name ?? actor.id} (${actor.role})`)

  const snapshot = await composeCityReportSnapshot({
    payload,
    actor,
    slug,
    readAt: new Date().toISOString(),
    codeSha: codeSha(),
    database: databaseLabel(rawDatabaseUrl),
  })

  const outPath = resolve(ROOT, out)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `[${LABEL}] snapshot de ${snapshot.municipality.name} → ${out} ` +
      `(lideranças=${snapshot.leaderships.totalCount} sinais=${snapshot.signals.totalCount} ` +
      `falas=${snapshot.speeches.totalCount} demandas=${snapshot.demands.totalCount})`,
  )
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
}

process.exit(0)
