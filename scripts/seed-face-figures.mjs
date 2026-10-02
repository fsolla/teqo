/**
 * C244 — seeds the initial curated catalog of public figures (`faceFigure`)
 * declared in `scripts/lib/faceFigureCatalogSeed.mjs`: the six named figures of
 * the owner's decision plus the state-deputy roster, WITHOUT reference
 * descriptors. A seeded figure never appears in the album facet until
 * `pnpm faces:enroll-figure` enrolls its references and the face index
 * recognizes it.
 *
 * Idempotent by slug: creates only the missing rows and never updates an
 * existing one (curation edits stay untouched).
 *
 * Modes:
 *   pnpm seed:face-figures            plan/dry-run (default) — shows the state
 *   pnpm seed:face-figures --apply    creates the missing rows; requires
 *                                     FACE_FIGURE_SEED_CONFIRM=1 outside local
 *                                     dev and the declared TEQO_ENV matching
 *                                     the exact database
 */
import { getPayload } from 'payload'

import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
} from './lib/cli.mjs'
import { faceFigureCatalogSeed } from './lib/faceFigureCatalogSeed.mjs'

loadCliEnv()

const die = dieWithLabel('seed:face-figures')
const WRITE_CONFIRM_FLAG = 'FACE_FIGURE_SEED_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm seed:face-figures [opções]

Cria as figuras públicas iniciais do filtro "Pessoa pública" do álbum (C244),
sem descritores de referência. Nome exibido e slug vêm do catálogo curado; o
enrollment das referências é feito pelo comando faces:enroll-figure.

Modos:
  (sem flag)         plano/dry-run — estado atual; sem escrita
  --apply            cria as figuras ausentes (exige ${WRITE_CONFIRM_FLAG}=1 fora do dev local)

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. O plano é read-only.
`

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP)
    process.exit(0)
  }
  const unknown = argv.find((arg) => arg !== '--apply')
  if (unknown) die(`argumento desconhecido: ${unknown} — uso: pnpm seed:face-figures [--apply].`)

  const apply = argv.includes('--apply')
  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  console.log(`[seed:face-figures] alvo: ${databaseTarget()} | modo: ${apply ? 'apply' : 'plan'}`)

  if (apply) {
    assertWriteConfirm({
      label: 'seed:face-figures',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm seed:face-figures --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })

  const entries = faceFigureCatalogSeed()
  let created = 0
  let existingCount = 0

  for (const entry of entries) {
    const found = await payload.find({
      collection: 'faceFigure',
      where: { slug: { equals: entry.slug } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    if (found.docs[0]) {
      existingCount += 1
      continue
    }

    if (!apply) continue
    await payload.create({
      collection: 'faceFigure',
      data: {
        name: entry.name,
        slug: entry.slug,
        ...(entry.fullName ? { fullName: entry.fullName } : {}),
        active: true,
      },
      depth: 0,
      overrideAccess: true,
    })
    created += 1
  }

  console.log(
    `[seed:face-figures] catálogo: ${entries.length} figura(s) | existentes: ${existingCount} | ${apply ? `criadas: ${created}` : `ausentes: ${entries.length - existingCount}`}`,
  )

  if (!apply) {
    console.log('\n[seed:face-figures] dry-run — use --apply para criar as ausentes.')
    process.exit(0)
  }
  console.log(
    '\n[seed:face-figures] OK — catálogo inicial garantido; enrole as referências com pnpm faces:enroll-figure.',
  )
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
