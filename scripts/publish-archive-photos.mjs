/**
 * C242 — publishes the photo archive in bulk: every `draft` photo becomes
 * `approved` so the public album (/fotos, C233) and the selfie search (C234/
 * C242) have what to show. The curation act is explicitly human and bulk
 * (decision of the owner, 2026-10-01); `removed` is NEVER touched — a takedown
 * stays a takedown.
 *
 * Modes:
 *   pnpm archive:publish                plan/dry-run (default) — the eligible queue; no write
 *   pnpm archive:publish --apply        approves the drafts; requires
 *                                       ARCHIVE_PUBLISH_CONFIRM=1 outside local dev
 *                                       and the declared TEQO_ENV matching the
 *                                       exact database
 *
 * Options: --limit <n> (canary), --out <dir> (receipts, default `data/archive`),
 * --help.
 *
 * Preconditions enforced fail-closed: the album global must have a valid
 * removal channel configured (the same guard the per-photo approval uses) —
 * a public photo always carries the takedown path.
 *
 * Runbook (after --apply, bust the public cache from a process that owns it):
 *   curl -X POST "https://jorgesolla1313.com.br/api/revalidate?tag=archivePhotos" \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET"
 */
import { join } from 'node:path'

import { getPayload } from 'payload'

import { isArchivePhotoRemovalChannelUrl } from '../src/lib/archivePhotoCatalog.ts'

import {
  ARCHIVE_PUBLISH_DEFAULT_OUT_DIR,
  archivePublishReportStamp,
  formatArchivePublishReport,
  parseArchivePublishCliArgs,
  summarizeArchivePublishResults,
} from './lib/archivePublishPlan.mjs'
import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  writeRepoFile,
} from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('archive:publish')

const WRITE_CONFIRM_FLAG = 'ARCHIVE_PUBLISH_CONFIRM'
const PAGE_SIZE = 200

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm archive:publish [opções]

Aprova em lote as fotos DRAFT do acervo (publicationStatus: draft → approved),
para o álbum público e a busca por selfie. Fotos "removed" nunca são tocadas.

Modos:
  (sem flag)         plano/dry-run — fila elegível; sem escrita
  --apply            aprova os drafts (exige ${WRITE_CONFIRM_FLAG}=1 fora do dev local)

Opções:
  --limit <n>        processa no máximo n fotos (canário)
  --out <dir>        diretório dos recibos (default ${ARCHIVE_PUBLISH_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. O plano é read-only.
`

const writeReport = async (options, report, suffix = '') => {
  const stamp = archivePublishReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `archive-publish-${stamp}${suffix}.json`)
  await writeRepoFile({
    label: 'archive:publish',
    root: process.cwd(),
    relativePath,
    body: JSON.stringify(report, null, 2),
  })
  return join(process.cwd(), relativePath)
}

async function main() {
  const options = parseArchivePublishCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  const mode = options.apply ? 'apply' : 'plan'
  const runAt = new Date().toISOString()
  console.log(`[archive:publish] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'archive:publish',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm archive:publish --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  const config = (await import('../src/payload.config.ts')).default
  const payload = await getPayload({ config })
  const startedAt = Date.now()

  const album = await payload
    .findGlobal({ slug: 'photoAlbum', depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!isArchivePhotoRemovalChannelUrl(album?.removalChannelUrl)) {
    die(
      'canal de remoção não configurado no global Álbum de fotos — aprove pelo admin antes do lote (a foto pública sempre carrega o caminho de remoção).',
    )
  }

  const drafts = await payload.find({
    collection: 'archivePhoto',
    where: { publicationStatus: { equals: 'draft' } },
    sort: ['id'],
    depth: 0,
    limit: 0,
    pagination: false,
    select: { id: true },
    // Intentional bypass: the publish CLI is a trusted operator with no session.
    overrideAccess: true,
  })
  const queue = options.limit ? drafts.docs.slice(0, options.limit) : drafts.docs

  if (mode === 'plan') {
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      queue: { totalDrafts: drafts.docs.length, items: queue.length },
      summary: { approved: 0, failed: 0, failures: [] },
      preview: queue.slice(0, 20).map((doc) => ({ photoId: doc.id })),
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatArchivePublishReport(report)) console.log(line)
    console.log(`\n[archive:publish] recibo JSON: ${reportPath}`)
    process.exit(0)
  }

  if (queue.length === 0) {
    console.log('[archive:publish] nada a fazer — nenhuma foto draft elegível.')
    process.exit(0)
  }

  const results = []
  for (let index = 0; index < queue.length; index += 1) {
    const photo = queue[index]
    try {
      await payload.update({
        collection: 'archivePhoto',
        id: photo.id,
        data: { publicationStatus: 'approved' },
        depth: 0,
        // Intentional bypass: same trusted operator.
        overrideAccess: true,
      })
      results.push({ photoId: photo.id, status: 'approved' })
    } catch (error) {
      results.push({
        photoId: photo.id,
        status: 'failed',
        error: error?.message ?? String(error),
      })
    }

    if ((index + 1) % PAGE_SIZE === 0) {
      console.log(`[archive:publish] … ${index + 1}/${queue.length}`)
    }
  }

  const summary = summarizeArchivePublishResults(results)
  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    queue: { totalDrafts: drafts.docs.length, items: queue.length },
    summary,
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatArchivePublishReport(report)) console.log(line)
  console.log(
    '\n[archive:publish] lembre de bustar a tag pública (processo Next): curl -X POST "https://jorgesolla1313.com.br/api/revalidate?tag=archivePhotos" -H "x-revalidate-secret: $REVALIDATE_SECRET"',
  )
  console.log(`[archive:publish] recibo JSON: ${reportPath}`)

  if (summary.approved === 0 && results.length > 0) {
    die('nenhuma foto foi aprovada — falhas listadas no recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
