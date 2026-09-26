/**
 * C231 — ingests the Flickr photo archive (conta `depjorgesolla`) into the
 * private Teqo storage: listing + metadata from the official API, originals
 * downloaded once and one `archivePhoto` row + object per photo, keyed by the
 * Flickr id. Re-running converges ("novas / já existiam / falharam com
 * motivo"), the receipt lands under `data/flickr/reports/`, and NOTHING in the
 * Flickr account is ever touched.
 *
 * Modes:
 *   pnpm flickr:import                 dry-run (default) — lists and maps the
 *                                      plan; no download, no write
 *   pnpm flickr:import --apply         downloads + creates; requires
 *                                      FLICKR_IMPORT_CONFIRM=1 outside local
 *                                      dev and the complete S3_* envs
 *   pnpm flickr:import --verify        read-only inventory of the stored
 *                                      archive (no Flickr, no bucket)
 *
 * Options: --limit <n> (canary), --page <n> (listing start page), --out <dir>
 * (receipts, default `data/flickr`), --help. `--limit` caps the photos
 * processed; the album walk still covers every album so a canary never loses
 * memberships.
 *
 * Guards: --apply refuses a non-local/production target without the intent
 * flag (C155) and demands the declared TEQO_ENV matching the exact database
 * name (C195/C231); a remote target also demands the complete S3_* set. The
 * API key lives in FLICKR_API_KEY (env only, never the repo) and the account
 * NSID in FLICKR_USER_ID.
 *
 * Runbook: on the homeserver, inside the compose maintenance service with the
 * stack env file — see docs/ops/teqo-1313-deploy.md.
 */
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

import {
  archivePhotoImportFromFlickr,
  archivePhotoStorageFilename,
} from '../src/lib/archivePhoto.ts'

import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  loadCliEnv,
  mirroredMediaRequired,
} from './lib/cli.mjs'
import { FLICKR_USER_AGENT, createFlickrClient } from './lib/flickrApi.mjs'
import {
  ARCHIVE_PHOTO_DEFAULT_OUT_DIR,
  archivePhotoReportStamp,
  collectArchiveAlbums,
  collectArchiveListing,
  formatArchiveBytes,
  formatArchiveInventory,
  formatArchiveReport,
  parseArchiveCliArgs,
  planArchiveEntries,
  summarizeArchiveInventory,
  summarizeArchivePlan,
  summarizeArchiveResults,
} from './lib/flickrPlan.mjs'

loadCliEnv()

const die = dieWithLabel('flickr:import')

const WRITE_CONFIRM_FLAG = 'FLICKR_IMPORT_CONFIRM'
/** A photo original is MBs; the guard only catches a stalled/runaway server. */
const PHOTO_DOWNLOAD_MAX_BYTES = 512 * 1024 * 1024
const PHOTO_DOWNLOAD_TIMEOUT_MS = 2 * 60_000

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm flickr:import [opções]

Ingere o acervo de fotos do Flickr da conta própria (FLICKR_USER_ID, NSID) no
storage privado do Teqo. A identidade é o id da foto no Flickr: reexecutar não
duplica e converge; toda falha sai nomeada no recibo (novas / já existiam /
falharam com motivo). Nada é publicado e nada no Flickr é tocado.

Modos (mutuamente exclusivos; o default é o plano):
  (sem flag)         plano/dry-run — lista, mapeia e reporta; sem download nem escrita
  --apply            baixa os originais e cria as linhas/objetos no alvo
  --verify           inventário read-only do que já está no acervo (sem Flickr)

Opções:
  --limit <n>        processa no máximo n fotos (a varredura de álbuns continua completa)
  --page <n>         começa a listagem na página n (retomada)
  --out <dir>        diretório dos recibos (default ${ARCHIVE_PHOTO_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  FLICKR_API_KEY     chave da API do Flickr (nunca no repo)
  FLICKR_USER_ID     NSID da conta (ex.: 12345678@N00)
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1, TEQO_ENV=${envLines}
casando o banco exato e as quatro envs S3_* (o original nunca vai para disco
efêmero). O dry-run e o --verify são read-only.
`

class StageError extends Error {
  constructor(stage, message) {
    super(message)
    this.name = 'StageError'
    this.stage = stage
  }
}

/** Runs one step, labelling any failure with its stage (receipt honesty). */
const withStage = async (stage, run) => {
  try {
    return await run()
  } catch (error) {
    if (error instanceof StageError) throw error
    throw new StageError(stage, error instanceof Error ? error.message : String(error))
  }
}

const writeReport = async (options, report, suffix = '') => {
  const stamp = archivePhotoReportStamp(report.runAt)
  const reportPath = join(options.out, 'reports', `flickr-${stamp}${suffix}.json`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  return reportPath
}

const reportBase = ({ runAt, mode, listing, albumsById, skippedAlbums }) => ({
  runAt,
  mode,
  target: databaseTarget(),
  apiTotal: listing.apiTotal,
  collected: listing.items.length,
  videos: listing.videos.length,
  malformed: listing.malformed,
  albums: albumsById.size,
  skippedAlbums,
})

/**
 * The write pass: per photo → exif (tolerant) → original (listing `url_o` or
 * the largest-size fallback) → download with a byte ceiling → transactional
 * ingest. Every failure is captured with its stage; the temp file is always
 * removed after the attempt.
 */
const applyEntries = async ({ client, payload, entries, tempRoot, download, ingest }) => {
  const results = []

  for (const entry of entries) {
    if (entry.status === 'existing') {
      results.push({ flickrId: entry.flickrId, status: 'existing' })
      console.log(`[flickr:import]   já existia ${entry.flickrId}`)
      continue
    }
    if (entry.status === 'invalid') {
      results.push({
        flickrId: entry.flickrId,
        status: 'failed',
        stage: 'metadata',
        error: `metadado inválido (${entry.reason})`,
      })
      console.log(`[flickr:import]   falha metadata ${entry.flickrId}: ${entry.reason}`)
      continue
    }

    let filePath = null
    try {
      const exif = await withStage('metadata', () => client.getExif(entry.flickrId))
      let fallbackOriginalUrl = null
      if (!entry.record) {
        const largest = await withStage('original', () => client.getLargestSize(entry.flickrId))
        fallbackOriginalUrl = largest?.url ?? null
      }
      const mapped = archivePhotoImportFromFlickr({
        photo: entry.photo,
        albums: entry.albums,
        exif,
        fallbackOriginalUrl,
      })
      if (!mapped.ok) {
        throw new StageError(
          mapped.reason === 'original' ? 'original' : 'metadata',
          `não foi possível mapear a foto (${mapped.reason})`,
        )
      }

      const record = mapped.record
      filePath = join(tempRoot, archivePhotoStorageFilename(record.flickrId, record.originalUrl))
      await withStage('download', () =>
        download({
          url: record.originalUrl,
          destinationPath: filePath,
          headers: { 'User-Agent': FLICKR_USER_AGENT },
          timeoutMs: PHOTO_DOWNLOAD_TIMEOUT_MS,
          maxBytes: PHOTO_DOWNLOAD_MAX_BYTES,
        }),
      )
      const bytes = (await stat(filePath)).size

      const result = await ingest(payload, record, { filePath })
      results.push({
        flickrId: entry.flickrId,
        status: result.status,
        stage: result.stage ?? null,
        error: result.error ?? null,
        bytes,
        originalKind: record.originalKind,
      })
      console.log(
        `[flickr:import]   ${result.status} ${entry.flickrId} (${formatArchiveBytes(bytes)}, ${record.originalKind})`,
      )
    } catch (error) {
      const stage = error instanceof StageError ? error.stage : 'download'
      const message = error instanceof Error ? error.message : String(error)
      results.push({ flickrId: entry.flickrId, status: 'failed', stage, error: message })
      console.log(`[flickr:import]   falha ${stage} ${entry.flickrId}: ${message}`)
    } finally {
      if (filePath) await rm(filePath, { force: true }).catch(() => undefined)
    }
  }

  return results
}

async function main() {
  const options = parseArchiveCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  const mode = options.apply ? 'apply' : options.verify ? 'verify' : 'plan'
  const runAt = new Date().toISOString()
  console.log(`[flickr:import] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'flickr:import',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm flickr:import --apply',
    })
    const target = assertEnvironmentDatabaseTarget()
    const { resolveS3StorageEnv } = await import('../src/utilities/mediaStorage.ts')
    const storage = resolveS3StorageEnv(process.env)
    if (mirroredMediaRequired({ s3Enabled: storage.enabled })) {
      die(
        `escrita em produção/remoto (${target.environment}) exige mídia espelhada: configure S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY; sem elas o original iria para disco local efêmero.`,
      )
    }
  }

  if (mode !== 'verify') {
    if (!process.env.FLICKR_API_KEY?.trim()) {
      die('FLICKR_API_KEY ausente — configure a chave da API do Flickr (veja .env.example).')
    }
    if (!process.env.FLICKR_USER_ID?.trim()) {
      die('FLICKR_USER_ID ausente — informe o NSID da conta (ex.: 12345678@N00).')
    }
  }

  const config = (await import('../src/payload.config.ts')).default
  const { downloadUrlToFile } = await import('../src/utilities/media/downloadToFile.ts')
  const { findArchivePhotoByFlickrId, ingestArchivePhoto, listArchivePhotos } =
    await import('../src/utilities/flickr/archivePhotoIngest.ts')
  const payload = await getPayload({ config })
  const startedAt = Date.now()

  if (mode === 'verify') {
    const rows = await listArchivePhotos(payload)
    const inventory = summarizeArchiveInventory(rows)
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      ...inventory,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report, '-verify')
    for (const line of formatArchiveInventory(inventory)) console.log(line)
    console.log(`\n[flickr:import] recibo JSON: ${reportPath}`)
    if (inventory.missingFilename.length > 0) {
      die(
        `${inventory.missingFilename.length} foto(s) sem arquivo armazenado — acervo inconsistente.`,
      )
    }
    process.exit(0)
  }

  const userId = process.env.FLICKR_USER_ID.trim()
  const client = createFlickrClient({ apiKey: process.env.FLICKR_API_KEY })

  console.log('[flickr:import] listando fotos e álbuns na API do Flickr...')
  const listing = await collectArchiveListing({
    client,
    userId,
    startPage: options.page,
    limit: options.limit,
  })
  const { albumsById, albumsByPhotoId, skippedAlbums } = await collectArchiveAlbums({
    client,
    userId,
  })
  console.log(
    `[flickr:import] listagem: ${listing.items.length} foto(s) de ${listing.apiTotal} na API · ${albumsById.size} álbum(ns)` +
      (skippedAlbums.length > 0
        ? ` · ${skippedAlbums.length} álbum(ns) sem id/título pulados`
        : ''),
  )

  const entries = await planArchiveEntries({
    items: listing.items,
    albumsByPhotoId,
    findExisting: (flickrId) => findArchivePhotoByFlickrId(payload, flickrId),
  })
  const plan = summarizeArchivePlan(entries)
  const base = reportBase({ runAt, mode, listing, albumsById, skippedAlbums })

  if (mode === 'plan') {
    const report = {
      ...base,
      plan,
      invalidEntries: entries
        .filter((entry) => entry.status === 'invalid')
        .map((entry) => ({ flickrId: entry.flickrId, reason: entry.reason })),
      entries: entries.map((entry) => ({
        flickrId: entry.flickrId,
        status: entry.status,
        reason: entry.reason ?? null,
        albums: entry.albums.map((album) => album.albumId),
        title: entry.record?.title ?? null,
        takenAt: entry.record?.takenAt ?? null,
      })),
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatArchiveReport(report)) console.log(line)
    console.log(`\n[flickr:import] recibo JSON: ${reportPath}`)
    process.exit(0)
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'flickr-archive-'))
  let results
  try {
    results = await applyEntries({
      client,
      payload,
      entries,
      tempRoot,
      download: downloadUrlToFile,
      ingest: ingestArchivePhoto,
    })
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }

  const summary = summarizeArchiveResults(results)
  const report = {
    ...base,
    plan,
    summary,
    results: results.map((result) => ({
      flickrId: result.flickrId,
      status: result.status,
      stage: result.stage ?? null,
      error: result.error ?? null,
      bytes: result.bytes ?? 0,
      originalKind: result.originalKind ?? null,
    })),
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatArchiveReport(report)) console.log(line)
  console.log(`\n[flickr:import] recibo JSON: ${reportPath}`)

  if (summary.created + summary.existing === 0 && results.length > 0) {
    die('nenhuma foto entrou no acervo — falhas listadas no recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
