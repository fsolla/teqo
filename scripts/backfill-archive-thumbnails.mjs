/**
 * C248 — backfill of the stored grade thumbnails of the public album: one
 * 720px AVIF q60 per APPROVED archive photo, written as a sibling object of
 * the stored original (same key space, derived name), so the public grid
 * serves it directly instead of resizing on every request.
 *
 * Read-only by default; `--apply` generates the missing grades and `--verify`
 * checks the coverage of the approved album. The generation is the SAME
 * function the route's lazy heal and the approval hook call, so the lote and
 * the serving path can never drift. Re-running converges: an existing grade
 * is skipped by HEAD, a missing/corrupt original is an honest skip with its
 * reason and a network/upload failure is a named failure for the next run.
 *
 * Safety model (fail-closed, mirrors `archive:integrity`):
 *   - --apply requires the explicit intent flag ARCHIVE_THUMBNAILS_CONFIRM=1
 *     on a non-local/production target and the declared TEQO_ENV matching the
 *     exact database name; a remote target also requires the complete S3_* set
 *     (the original lives in the private bucket there).
 *   - Only APPROVED photos with a stored file are eligible: draft/removed rows
 *     are out (generating for them would be discarded work) and neither the
 *     original nor any row is ever written.
 *   - Serialize with `archive:catalog` / `archive:integrity` (the C245/C246
 *     ops touch the same originals): a missing original is regenerated after
 *     the C246 recovery with a new `--apply`.
 *
 * Modes:
 *   pnpm archive:thumbnails              plan — lists the eligible album and
 *                                        how many grades are missing (HEAD)
 *   pnpm archive:thumbnails --apply      generates the missing grades
 *   pnpm archive:thumbnails --verify     coverage acceptance check
 *
 * Options: --only <ids>, --limit <n> (canary), --concurrency <n> (default 3),
 * --out <dir> (receipts, default `data/archive`), --help.
 *
 * Runbook (production): on the homeserver, inside the compose maintenance
 * service with the stack env — see docs/ops/teqo-1313-deploy.md §C248.
 */
import { join } from 'node:path'

import { getPayload } from 'payload'

import {
  ARCHIVE_THUMBNAIL_DEFAULT_CONCURRENCY,
  ARCHIVE_THUMBNAIL_DEFAULT_OUT_DIR,
  archiveThumbnailEligibleRows,
  archiveThumbnailReportStamp,
  formatArchiveThumbnailProbeReport,
  formatArchiveThumbnailRunReport,
  parseArchiveThumbnailCliArgs,
  summarizeArchiveThumbnailProbe,
  summarizeArchiveThumbnailRun,
} from './lib/archiveThumbnailPlan.mjs'
import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  mapWithConcurrency,
  mirroredMediaRequired,
  writeRepoFile,
} from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('archive:thumbnails')

const WRITE_CONFIRM_FLAG = 'ARCHIVE_THUMBNAILS_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm archive:thumbnails [opções]

Gera as miniaturas AVIF 720px q60 do álbum público somente para fotos
APROVADAS com arquivo armazenado — o irmão determinístico
flickr-<id>-grade.avif no mesmo store privado do original (nada de banco,
nada de original alterado). Reexecutar converge: miniatura existente é
pulada por HEAD; original ausente/ilegível é pulada com motivo; falha de
rede/upload fica registrada para a próxima execução.

Modos (mutuamente exclusivos; o default é o plano):
  (sem flag)         plano read-only — lista elegíveis e quantas faltam
  --apply            gera as miniaturas faltantes (escrita só de objetos)
  --verify           checagem de cobertura (exit 1 se faltar alguma)

Opções:
  --only <ids>       restringe a ids de foto separados por vírgula (ex.: --only 80,83)
  --limit <n>        --apply: processa no máximo n fotos (canário); no plano/verify, limita a checagem
  --concurrency <n>  workers simultâneos (default ${ARCHIVE_THUMBNAIL_DEFAULT_CONCURRENCY})
  --out <dir>        diretório dos recibos (default ${ARCHIVE_THUMBNAIL_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL             alvo (obrigatório em todos os modos)
  S3_*                     obrigatório no --apply de alvo não-local (o original vive no bucket)
  ARCHIVE_THUMBNAILS_CONFIRM=1  intenção explícita de escrita em alvo não-local/produção
  TEQO_ENV=${envLines}   casa o banco exato no --apply

Serialização: rode em janela própria, sem archive:catalog / archive:integrity
concorrentes (C245/C246 tocam os mesmos originais). Após um --apply em produção,
nada a revalidar: a rota descobre a miniatura por chave determinística.
`

const writeReport = async (options, report, suffix = '') => {
  const stamp = archiveThumbnailReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `archive-thumbnails-${stamp}${suffix}.json`)
  await writeRepoFile({
    label: 'archive:thumbnails',
    root: process.cwd(),
    relativePath,
    body: JSON.stringify(report, null, 2),
  })
  return relativePath
}

async function main() {
  const options = parseArchiveThumbnailCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  const mode = options.apply ? 'apply' : options.verify ? 'verify' : 'plan'
  const runAt = new Date().toISOString()
  console.log(`[archive:thumbnails] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'archive:thumbnails',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm archive:thumbnails --apply',
    })
    assertEnvironmentDatabaseTarget()

    const { resolveS3StorageEnv } = await import('../src/utilities/mediaStorage.ts')
    const storage = resolveS3StorageEnv(process.env)
    if (mirroredMediaRequired({ s3Enabled: storage.enabled })) {
      die(
        'escrita em produção/remoto exige mídia espelhada: configure S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY; sem elas o original não está acessível no alvo.',
      )
    }
  }

  const config = (await import('../src/payload.config.ts')).default
  const { listArchivePhotos } = await import('../src/utilities/flickr/archivePhotoIngest.ts')
  const { generateArchivePhotoGrade } =
    await import('../src/utilities/archivePhotos/archivePhotoThumbnails.ts')
  const { privateMediaObjectExists, resolvePrivateMediaStaticDir } =
    await import('../src/utilities/privateMedia/privateMediaResponse.ts')
  const { ARCHIVE_PHOTO_SLUG } = await import('../src/lib/archivePhoto.ts')
  const { archivePhotoGradeFilename } = await import('../src/lib/archivePhotoThumbnail.ts')

  const payload = await getPayload({ config })
  const startedAt = Date.now()
  const staticDir = resolvePrivateMediaStaticDir(payload, ARCHIVE_PHOTO_SLUG)

  const rows = await listArchivePhotos(payload)
  const eligible = archiveThumbnailEligibleRows(rows)
  const scoped = options.only ? eligible.filter((row) => options.only.includes(row.id)) : eligible
  const selected = options.limit ? scoped.slice(0, options.limit) : scoped

  console.log(
    `[archive:thumbnails] álbum aprovado: ${eligible.length} foto(s) elegível(is); processando ${selected.length}`,
  )

  const gradeExists = (row) =>
    privateMediaObjectExists({
      filename: archivePhotoGradeFilename(row.filename),
      staticDir,
    })

  if (mode === 'plan' || mode === 'verify') {
    const probeResults = await mapWithConcurrency(selected, options.concurrency, async (row) => ({
      id: row.id,
      flickrId: row.flickrId,
      filename: row.filename,
      present: await gradeExists(row),
    }))
    const probe = summarizeArchiveThumbnailProbe(probeResults)
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      eligibleTotal: eligible.length,
      concurrency: options.concurrency,
      probe,
      results: probeResults,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report, `-${mode}`)
    for (const line of formatArchiveThumbnailProbeReport(report)) console.log(line)
    console.log(`\n[archive:thumbnails] recibo JSON: ${reportPath}`)
    if (mode === 'verify' && probe.missing > 0) {
      die(`${probe.missing} miniatura(s) faltando — aceite do C248 não satisfeito.`)
    }
    process.exit(0)
  }

  const results = await mapWithConcurrency(selected, options.concurrency, async (row) => {
    const outcome = (await gradeExists(row))
      ? { status: 'skipped', reason: 'already-present' }
      : await generateArchivePhotoGrade(payload, { filename: row.filename })
    const detail =
      outcome.status === 'skipped' && outcome.detail
        ? ` [${outcome.reason}]: ${outcome.detail}`
        : outcome.status === 'failed'
          ? ` [${outcome.reason}]`
          : ''
    console.log(`[archive:thumbnails]   ${outcome.status}${detail} ${row.flickrId}`)
    return { id: row.id, flickrId: row.flickrId, filename: row.filename, outcome }
  })

  const summary = summarizeArchiveThumbnailRun(results)
  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    eligibleTotal: eligible.length,
    concurrency: options.concurrency,
    summary,
    results: results.map((result) => ({
      id: result.id,
      flickrId: result.flickrId,
      filename: result.filename,
      status: result.outcome.status,
      reason: result.outcome.reason ?? null,
      detail: result.outcome.detail ?? null,
      bytes: result.outcome.bytes ?? null,
    })),
    skipped: results
      .filter((result) => result.outcome.status === 'skipped')
      .map((result) => ({
        id: result.id,
        filename: result.filename,
        reason: result.outcome.reason,
        detail: result.outcome.detail ?? null,
      })),
    failed: results
      .filter((result) => result.outcome.status === 'failed')
      .map((result) => ({
        id: result.id,
        filename: result.filename,
        reason: result.outcome.reason,
      })),
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatArchiveThumbnailRunReport(report)) console.log(line)
  console.log(`\n[archive:thumbnails] recibo JSON: ${reportPath}`)

  if (summary.failed > 0) {
    die(`${summary.failed} falha(s) — o recibo lista os motivos; reexecutar retenta.`)
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
