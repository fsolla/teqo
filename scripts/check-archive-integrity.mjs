/**
 * C246 — integrity sweep of the private photo archive (C231): every
 * `archivePhoto` row is downloaded through the SAME path the public media route
 * and the face index use (the S3 SDK validates the stored checksum on the GET)
 * and then decoded with sharp; a missing object is `missing`, a read failure or
 * an undecodable file is `corrupt`, and the receipt names every one with its
 * motive. The sweep is READ-ONLY by default and exits 1 while any non-removed
 * photo is broken — that exit is the convergence criteria.
 *
 * With `--apply`, each broken photo is re-ingested from Flickr by `flickrId`
 * (the same `getLargestSize` fallback the C231 ingestion documents), the
 * downloaded original is decoded to prove it is a real image, and the object is
 * replaced through the collection's own upload write path
 * (`repairArchivePhotoObject`) — same key, no metadata/curation/status write.
 * A photo whose Flickr source is gone (or does not decode) leaves the public
 * with a record (`approved → draft`); `removed` is never touched.
 *
 * Modes:
 *   pnpm archive:integrity                 sweep (default) — read-only, no writes
 *   pnpm archive:integrity --apply         sweep + repair; requires
 *                                          ARCHIVE_INTEGRITY_CONFIRM=1 outside
 *                                          local dev, the declared TEQO_ENV
 *                                          matching the exact database, the
 *                                          complete S3_* envs and FLICKR_API_KEY
 *
 * Options: --only <ids> (canary, comma-separated row ids), --limit <n> (canary),
 * --concurrency <n> (default 3), --out <dir> (receipts, default `data/archive`),
 * --help.
 *
 * Guards: --apply refuses a non-local/production target without the intent flag
 * (C155) and demands the declared TEQO_ENV matching the exact database name
 * (C195/C231); a non-local target also demands the complete S3_* set in BOTH
 * modes (without S3 the sweep would measure the wrong storage).
 *
 * Runbook: on the homeserver, inside the compose maintenance service with the
 * stack env file — see docs/ops/teqo-1313-deploy.md. After a `--apply` that
 * withdrew a photo, bust the public cache from a process that owns it:
 *   curl -X POST "https://jorgesolla1313.com.br/api/revalidate?tag=archivePhotos" ...
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getPayload } from 'payload'

import {
  ARCHIVE_INTEGRITY_DEFAULT_CONCURRENCY,
  ARCHIVE_INTEGRITY_DEFAULT_OUT_DIR,
  archiveIntegrityReportStamp,
  formatArchiveIntegrityRepairReport,
  formatArchiveIntegrityScanReport,
  mapWithConcurrency,
  parseArchiveIntegrityCliArgs,
  summarizeArchiveIntegrityRepair,
  summarizeArchiveIntegrityScan,
} from './lib/archiveIntegrityPlan.mjs'
import { repairArchivePhotoFromSource } from './lib/archiveIntegrityRepair.mjs'
import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  mirroredMediaRequired,
  writeRepoFile,
} from './lib/cli.mjs'
import { createFlickrClient } from './lib/flickrApi.mjs'

loadCliEnv()

const die = dieWithLabel('archive:integrity')

const WRITE_CONFIRM_FLAG = 'ARCHIVE_INTEGRITY_CONFIRM'
const PROGRESS_EVERY = 250

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm archive:integrity [opções]

Varre a integridade dos originais do acervo privado (archivePhoto): baixa cada
objeto pelo mesmo caminho da rota pública e do índice facial e força o decode
com sharp. O recibo nomeia cada foto ausente/corrompida com o motivo. Reexecutar
converge; a varredura é read-only e sai 1 enquanto houver mídia quebrada pública.

Modos:
  (sem flag)         varredura read-only — todas as fotos; sem escrita
  --apply            varredura + recuperação: re-ingere do Flickr pelo flickrId,
                     substitui o objeto na MESMA chave (sem tocar curadoria nem
                     status) e rebaixa a draft as irrecuperáveis (fonte sumiu)

Opções:
  --only <ids>       canário: só os ids de linha informados (ex.: --only 80,83)
  --limit <n>        processa no máximo n fotos (canário)
  --concurrency <n>  downloads simultâneos (default ${ARCHIVE_INTEGRITY_DEFAULT_CONCURRENCY})
  --out <dir>        diretório dos recibos (default ${ARCHIVE_INTEGRITY_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)
  FLICKR_API_KEY     chave da API do Flickr (exigida no --apply)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1 e TEQO_ENV=${envLines}
casando o banco exato. Alvo não-local exige as quatro envs S3_* em QUALQUER modo
(sem S3 a varredura mediria o storage errado).
`

const writeReport = async (options, report, suffix = '') => {
  const stamp = archiveIntegrityReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `archive-integrity-${stamp}${suffix}.json`)
  await writeRepoFile({
    label: 'archive:integrity',
    root: process.cwd(),
    relativePath,
    body: JSON.stringify(report, null, 2),
  })
  return join(process.cwd(), relativePath)
}

const selectRows = (rows, options) => {
  let selected = rows
  if (options.only) {
    const wanted = new Set(options.only)
    selected = selected.filter((row) => wanted.has(row.id))
  }
  if (options.limit !== null) selected = selected.slice(0, options.limit)
  return selected
}

/**
 * One read-only probe: download + decode, with the caller-owned temp removed
 * right away (6k+ photos cannot accumulate on disk).
 */
const inspectRow = async ({ row, tempRoot, staticDir, inspect }) => {
  const dir = join(tempRoot, String(row.id))
  await mkdir(dir, { recursive: true })
  const filename = row.filename ?? null
  const destinationPath = join(dir, filename ?? `foto-${row.id}.bin`)
  try {
    const inspection = await inspect({
      media: { filename },
      staticDir,
      destinationPath,
    })
    return {
      id: row.id,
      flickrId: String(row.flickrId),
      filename,
      publicationStatus: row.publicationStatus,
      ...inspection,
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function main() {
  const options = parseArchiveIntegrityCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  const mode = options.apply ? 'repair' : 'verify'
  const runAt = new Date().toISOString()
  console.log(`[archive:integrity] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (mode === 'repair') {
    assertWriteConfirm({
      label: 'archive:integrity',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm archive:integrity --apply',
    })
    assertEnvironmentDatabaseTarget()
  }

  const { resolveS3StorageEnv } = await import('../src/utilities/mediaStorage.ts')
  const storage = resolveS3StorageEnv(process.env)
  if (mirroredMediaRequired({ s3Enabled: storage.enabled })) {
    die(
      'alvo não-local exige mídia espelhada: configure S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY; sem elas a varredura mediria o storage errado.',
    )
  }
  if (mode === 'repair' && !process.env.FLICKR_API_KEY?.trim()) {
    die('FLICKR_API_KEY ausente — o reparo re-ingere do Flickr (veja .env.example).')
  }

  const config = (await import('../src/payload.config.ts')).default
  const { listArchivePhotos, repairArchivePhotoObject, withdrawArchivePhotoFromPublic } =
    await import('../src/utilities/flickr/archivePhotoIngest.ts')
  const { inspectPrivateMediaObject, resolvePrivateMediaStaticDir } =
    await import('../src/utilities/privateMedia/privateMediaResponse.ts')
  const { downloadUrlToFile } = await import('../src/utilities/media/downloadToFile.ts')
  const payload = await getPayload({ config })
  const startedAt = Date.now()
  const staticDir = resolvePrivateMediaStaticDir(payload, 'archivePhoto')

  const allRows = await listArchivePhotos(payload)
  const selected = selectRows(allRows, options)
  if (options.only && selected.length === 0) {
    die(`--only ${options.only.join(',')} não casou nenhuma foto do acervo (ids de linha).`)
  }
  if (options.only && selected.length !== options.only.length) {
    const found = new Set(selected.map((row) => row.id))
    console.log(
      `[archive:integrity] aviso: --only ignorou id(s) sem linha no acervo: ${options.only
        .filter((id) => !found.has(id))
        .join(', ')}`,
    )
  }
  console.log(
    `[archive:integrity] fila: ${selected.length} de ${allRows.length} foto(s) (concorrência ${options.concurrency})`,
  )

  const tempRoot = await mkdtemp(join(tmpdir(), 'archive-integrity-'))
  let report
  let scan
  let repair = null
  try {
    let processed = 0
    const results = await mapWithConcurrency(selected, options.concurrency, async (row) => {
      const result = await inspectRow({
        row,
        tempRoot,
        staticDir,
        inspect: inspectPrivateMediaObject,
      })
      processed += 1
      if (result.status !== 'ok') {
        const detail = result.status === 'missing' ? 'ausente' : `corrompida [${result.stage}]`
        console.log(
          `[archive:integrity]   ${detail} ${result.id}: ${result.reason ?? 'objeto ausente'}`,
        )
      }
      if (processed % PROGRESS_EVERY === 0) {
        console.log(`[archive:integrity] … ${processed}/${selected.length}`)
      }
      return result
    })

    scan = summarizeArchiveIntegrityScan(results)

    if (mode === 'repair') {
      const rowsById = new Map(selected.map((row) => [row.id, row]))
      // The summary owns the "removed never enters the repair" rule.
      const brokenIds = new Set([...scan.missing, ...scan.corrupted].map((item) => item.id))
      const broken = results.filter((result) => brokenIds.has(result.id))

      const client = createFlickrClient({ apiKey: process.env.FLICKR_API_KEY })
      const withdraw = async ({ id, flickrId, filename, reason }) => {
        const result = await withdrawArchivePhotoFromPublic(payload, { id, flickrId })
        if (result.status === 'withdrawn') {
          return {
            id,
            flickrId,
            filename,
            action: 'unrecoverable',
            previousStatus: result.previousStatus,
            newStatus: 'draft',
            reason,
          }
        }
        // An already-draft photo was already out of the public: record the
        // unrecoverable verdict without pretending a status change happened.
        return { id, flickrId, filename, action: 'unrecoverable', reason }
      }

      const repairResults = await mapWithConcurrency(broken, options.concurrency, async (entry) => {
        const row = rowsById.get(entry.id)
        const result = await repairArchivePhotoFromSource({
          row,
          tempRoot,
          staticDir,
          inspect: inspectPrivateMediaObject,
          payload,
          client,
          repair: repairArchivePhotoObject,
          download: downloadUrlToFile,
          withdraw,
        })
        const detail =
          result.action === 'recovered'
            ? `recuperada (${result.sourceUrl ?? 'fonte'})`
            : `${result.action}${result.reason ? `: ${result.reason}` : ''}`
        console.log(`[archive:integrity]   ${entry.id}: ${detail}`)
        return result
      })

      repair = summarizeArchiveIntegrityRepair(repairResults)
      report = {
        runAt,
        mode,
        target: databaseTarget(),
        scan,
        repair,
        results,
        repairResults,
        durationMs: Date.now() - startedAt,
      }
    } else {
      report = {
        runAt,
        mode,
        target: databaseTarget(),
        scan,
        results,
        durationMs: Date.now() - startedAt,
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }

  const reportPath = await writeReport(options, report, mode === 'repair' ? '-repair' : '')
  for (const line of formatArchiveIntegrityScanReport(report)) console.log(line)
  if (mode === 'repair') {
    for (const line of formatArchiveIntegrityRepairReport(report)) console.log(line)
    console.log(
      '\n[archive:integrity] se houve saída do público, buste a tag: curl -X POST "https://jorgesolla1313.com.br/api/revalidate?tag=archivePhotos" -H "x-revalidate-secret: $REVALIDATE_SECRET"',
    )
    console.log(
      '[archive:integrity] lembre de rodar `pnpm faces:index` — a foto recuperada cujo índice falhou é reprocessada sozinha.',
    )
  }
  console.log(`[archive:integrity] recibo JSON: ${reportPath}`)

  if (mode === 'verify' && scan.pending > 0) {
    die(
      `${scan.pending} foto(s) com mídia quebrada pública — o acervo ainda não está íntegro; rode o --apply para recuperar.`,
    )
  }
  if (mode === 'repair' && repair.failed.length > 0) {
    die(`${repair.failed.length} foto(s) falharam no reparo — falhas listadas no recibo.`)
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
