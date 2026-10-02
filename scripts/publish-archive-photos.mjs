/**
 * C242 — publishes the photo archive in bulk: every `draft` photo becomes
 * `approved` so the public album (/fotos, C233) and the selfie search (C234/
 * C242) have what to show. The curation act is explicitly human and bulk
 * (decision of the owner, 2026-10-01); `removed` is NEVER touched — a takedown
 * stays a takedown.
 *
 * C249 — every eligible draft goes through the C246 integrity probe before any
 * approval: the object is downloaded through the same serving path and decoded;
 * a missing/undecodable object stays `draft`, is named in the receipt as
 * `skippedBroken` (stage + reason) and the command exits 1. The runbook warning
 * stopped being the only protection.
 *
 * Modes:
 *   pnpm archive:publish                plan/dry-run (default) — the eligible
 *                                       queue + preflight; no write
 *   pnpm archive:publish --apply        approves the drafts whose object
 *                                       inspects clean; requires
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
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { getPayload } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '../src/lib/archivePhoto.ts'
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

Antes de aprovar, cada draft passa pelo preflight de integridade do C246: o
objeto é baixado pelo mesmo caminho da rota pública e decodificado. Objeto
ausente/corrompido fica fora do lote, é nomeado no recibo (stage + motivo) e o
comando sai 1.

Modos:
  (sem flag)         plano/dry-run — fila elegível + preflight; sem escrita
  --apply            aprova os drafts com objeto íntegro (exige ${WRITE_CONFIRM_FLAG}=1 fora do dev local)

Opções:
  --limit <n>        processa no máximo n fotos (canário)
  --out <dir>        diretório dos recibos (default ${ARCHIVE_PUBLISH_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. O plano é read-only.
`

const writeReport = async (options, report) => {
  const stamp = archivePublishReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `archive-publish-${stamp}.json`)
  await writeRepoFile({
    label: 'archive:publish',
    root: process.cwd(),
    relativePath,
    body: JSON.stringify(report, null, 2),
  })
  return join(process.cwd(), relativePath)
}

const emitReport = async (options, report, hint = null) => {
  const reportPath = await writeReport(options, report)
  for (const line of formatArchivePublishReport(report)) console.log(line)
  if (hint) console.log(`\n${hint}`)
  console.log(`[archive:publish] recibo JSON: ${reportPath}`)
}

/**
 * C249 — one read-only preflight probe: download + decode through the SAME
 * owner the C246 sweep uses, with a temp dir created and removed per photo.
 * Nothing here writes to the archive; the verdict is `ok` or `skippedBroken`.
 */
const inspectPhoto = async ({ photo, tempRoot, staticDir, inspect }) => {
  const dir = join(tempRoot, String(photo.id))
  await mkdir(dir, { recursive: true })
  const filename = photo.filename ?? null
  try {
    const inspection = await inspect({
      media: { filename },
      staticDir,
      destinationPath: join(dir, filename ?? `foto-${photo.id}.bin`),
    })
    if (inspection.status === 'ok') return { photoId: photo.id, status: 'ok' }
    return {
      photoId: photo.id,
      status: 'skippedBroken',
      stage: inspection.status === 'missing' ? 'missing' : inspection.stage,
      reason: inspection.status === 'missing' ? 'objeto ausente' : inspection.reason,
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * C249 — the batch, exported so the int spec drives the real Payload/utility
 * path with its own queue (never the whole database). Every photo is
 * preflighted before any approval; `apply: false` classifies without writing.
 * The receipt owns the human/JSON naming — this function only returns verdicts.
 *
 * @param {object} options
 * @param {import('payload').Payload} options.payload
 * @param {Array<{ id: number, filename?: string | null }>} options.queue
 * @param {Function} options.inspect `inspectPrivateMediaObject`
 * @param {string} options.staticDir local fallback dir of the collection
 * @param {boolean} options.apply whether the clean drafts are approved
 * @param {(line: string) => void} [options.log]
 * @returns {Promise<Array<{ photoId: number, status: 'ok' | 'eligible' | 'approved' | 'failed' | 'skippedBroken', stage?: string, reason?: string, error?: string }>>}
 */
export const runArchivePublishBatch = async ({
  payload,
  queue,
  inspect,
  staticDir,
  apply,
  log = console.log,
}) => {
  const results = []
  const tempRoot = await mkdtemp(join(tmpdir(), 'archive-publish-'))
  try {
    for (let index = 0; index < queue.length; index += 1) {
      const photo = queue[index]
      const preflight = await inspectPhoto({ photo, tempRoot, staticDir, inspect })

      if (preflight.status !== 'ok') {
        results.push(preflight)
      } else if (!apply) {
        results.push({ photoId: photo.id, status: 'eligible' })
      } else {
        try {
          await payload.update({
            collection: ARCHIVE_PHOTO_SLUG,
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
      }

      if ((index + 1) % PAGE_SIZE === 0) {
        log(`[archive:publish] … ${index + 1}/${queue.length}`)
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
  return results
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
  const { inspectPrivateMediaObject, resolvePrivateMediaStaticDir } =
    await import('../src/utilities/privateMedia/privateMediaResponse.ts')
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
    collection: ARCHIVE_PHOTO_SLUG,
    where: { publicationStatus: { equals: 'draft' } },
    sort: ['id'],
    depth: 0,
    limit: 0,
    pagination: false,
    select: { id: true, filename: true },
    // Intentional bypass: the publish CLI is a trusted operator with no session.
    overrideAccess: true,
  })
  const queue = options.limit ? drafts.docs.slice(0, options.limit) : drafts.docs

  if (mode === 'apply' && queue.length === 0) {
    console.log('[archive:publish] nada a fazer — nenhuma foto draft elegível.')
    process.exit(0)
  }

  const staticDir = resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)
  const results = await runArchivePublishBatch({
    payload,
    queue,
    inspect: inspectPrivateMediaObject,
    staticDir,
    apply: mode === 'apply',
  })

  const summary = summarizeArchivePublishResults(results)

  if (mode === 'plan') {
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      queue: { totalDrafts: drafts.docs.length, items: queue.length },
      summary,
      preview: queue.slice(0, 20).map((doc) => ({ photoId: doc.id })),
      durationMs: Date.now() - startedAt,
    }
    await emitReport(options, report)
    if (summary.skippedBrokenCount > 0) {
      die(
        `${summary.skippedBrokenCount} foto(s) draft com objeto quebrado/ausente — fora do lote; veja o recibo.`,
      )
    }
    process.exit(0)
  }

  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    queue: { totalDrafts: drafts.docs.length, items: queue.length },
    summary,
    durationMs: Date.now() - startedAt,
  }
  await emitReport(
    options,
    report,
    '[archive:publish] lembre de bustar a tag pública (processo Next): curl -X POST "https://jorgesolla1313.com.br/api/revalidate?tag=archivePhotos" -H "x-revalidate-secret: $REVALIDATE_SECRET"',
  )

  if (summary.skippedBrokenCount > 0) {
    die(
      `${summary.skippedBrokenCount} foto(s) draft com objeto quebrado/ausente ficaram fora do lote — veja o recibo.`,
    )
  }
  if (summary.approved === 0 && results.length > 0) {
    die('nenhuma foto foi aprovada — falhas listadas no recibo.')
  }
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  loadCliEnv()
  main().catch((error) => {
    die(error?.message || String(error))
  })
}
