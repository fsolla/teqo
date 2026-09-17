/**
 * Snapshot extractor for the institutional dossiê (C187).
 *
 * Runs where production lives (homeserver), read-only by connection options,
 * and writes a JSON snapshot consumed by
 * `scripts/build-dossie-solla-instituicao.mjs`. Nothing is persisted.
 *
 * The token is resolved fail-closed against the catalog; a one-off institution
 * uses the explicit escape `--slug=<x> --name="<Nome>"`.
 *
 * Usage (from the homeserver, with `~/stack/teqo-1313.env` loaded):
 *   INSTITUTION_REPORT_CONFIRM=1 NODE_OPTIONS="--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs" \
 *     node scripts/extract-institution-snapshot.mjs --institution=ufba --out=data/dossie-solla-instituicao/ufba.institution.snapshot.json
 */

import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getInstitutionCatalogEntry,
  INSTITUTION_KIND_LABELS,
  INSTITUTION_KINDS,
  INSTITUTION_SCOPE_LABELS,
  INSTITUTION_SCOPES,
  INSTITUTION_SPHERE_LABELS,
  INSTITUTION_SPHERES,
  institutionSlugs,
} from '../src/lib/institutionCatalog.ts'
import { databaseLabel } from './lib/cityReportDatabase.mjs'
import { dieWithLabel, loadCliEnv, parseEqualsFlags } from './lib/cli.mjs'
import { enterReadOnlySession, resolveCampaignActor } from './lib/readOnlyExtract.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LABEL = 'extract-institution-snapshot'
const die = dieWithLabel(LABEL)

const codeSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  } catch {
    return null
  }
}

const oneOf = (value, allowed, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  const normalized = String(value).trim()
  return allowed.includes(normalized) ? normalized : fallback
}

/**
 * Resolve the identity: catalog entry, or the explicit one-off escape. Unknown
 * token fails closed with an actionable message — never an invented slug.
 */
const resolveIdentity = (flags) => {
  if (typeof flags.institution === 'string' && flags.institution.trim()) {
    const entry = getInstitutionCatalogEntry(flags.institution.trim())
    if (!entry) {
      die(
        `Instituição desconhecida no catálogo: "${flags.institution}".\n` +
          `  Conhecidas: ${institutionSlugs().join(', ')}.\n` +
          '  Adicione alias/entrada em src/lib/institutionCatalog.ts ou use o escape one-off: --slug=<x> --name="<Nome>".',
      )
    }
    return {
      slug: entry.slug,
      name: entry.name,
      kind: entry.kind,
      sphere: entry.sphere,
      scope: entry.scope,
      aliases: [...entry.aliases],
      topics: [...entry.topics],
    }
  }

  const slug = typeof flags.slug === 'string' ? flags.slug.trim() : ''
  const name = typeof flags.name === 'string' ? flags.name.trim() : ''
  if (!slug || !name) {
    die(
      'Uso: --institution=<slug> --out=<arquivo.json>\n' +
        '  Ou escape one-off: --slug=<x> --name="<Nome>" [--kind= --sphere= --scope= --topics=a,b] --out=<arquivo.json>\n' +
        '  Env: INSTITUTION_REPORT_CONFIRM=1 (obrigatório), DATABASE_URL (read-only é forçado).',
    )
  }
  const topics =
    typeof flags.topics === 'string'
      ? flags.topics
          .split(',')
          .map((topic) => topic.trim())
          .filter(Boolean)
      : []
  return {
    slug,
    name,
    kind: oneOf(flags.kind, INSTITUTION_KINDS, 'outro'),
    sphere: oneOf(flags.sphere, INSTITUTION_SPHERES, 'nao_governamental'),
    scope: oneOf(flags.scope, INSTITUTION_SCOPES, 'nacional'),
    aliases: [],
    topics,
  }
}

loadCliEnv()

const { flags } = parseEqualsFlags(process.argv.slice(2))
const out = typeof flags.out === 'string' ? flags.out : null
const identity = resolveIdentity(flags)

if (!out) {
  die('Uso: --institution=<slug> --out=<arquivo.json> (ou o escape --slug/--name).')
}

const rawDatabaseUrl = enterReadOnlySession({
  confirmEnv: 'INSTITUTION_REPORT_CONFIRM',
  label: LABEL,
  die,
  context: `instituição ${identity.slug}`,
})

const { default: configPromise } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const { composeInstitutionSnapshot } = await import('./institutionSnapshot.mjs')

const payload = await getPayload({ config: configPromise })

try {
  const actor = await resolveCampaignActor(payload, { die })
  console.log(`[${LABEL}] ator: ${actor.name ?? actor.id} (${actor.role})`)

  const snapshot = await composeInstitutionSnapshot({
    payload,
    actor,
    identity: {
      ...identity,
      kindLabel: INSTITUTION_KIND_LABELS[identity.kind],
      sphereLabel: INSTITUTION_SPHERE_LABELS[identity.sphere],
      scopeLabel: INSTITUTION_SCOPE_LABELS[identity.scope],
    },
    readAt: new Date().toISOString(),
    codeSha: codeSha(),
    database: databaseLabel(rawDatabaseUrl),
  })

  const outPath = resolve(ROOT, out)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `[${LABEL}] snapshot de ${snapshot.institution.name} → ${out} ` +
      `(falas=${snapshot.speeches.totalCount} temas=${snapshot.speeches.topics.join(',') || '—'} lacunas=${snapshot.gaps.length})`,
  )
} catch (error) {
  die(error instanceof Error ? error.message : String(error))
}

process.exit(0)
