/**
 * C232 — catalogues the private photo archive (C231) with the local vision
 * engine: each pending `archivePhoto` is downloaded from the private storage,
 * downscaled, analysed by an OpenAI-compatible VLM on the private network and
 * written back as a revisable ficha — the assessoria's curation always wins and
 * re-running converges ("processadas / puladas / falharam com motivo"). Nothing
 * is published and no photo leaves the private network without the explicit
 * remote escape; the model never names people.
 *
 * Modes:
 *   pnpm archive:catalog                plan/dry-run (default) — lists the
 *                                       pending queue; no engine call, no write
 *   pnpm archive:catalog --apply        catalogues the pending photos; requires
 *                                       ARCHIVE_CATALOG_CONFIRM=1 outside local
 *                                       dev, the complete S3_* envs and the
 *                                       vision engine envs
 *   pnpm archive:catalog --verify       read-only inventory of the catalogue
 *
 * Options: --limit <n> (canary), --out <dir> (receipts, default `data/archive`),
 * --help.
 *
 * Guards: --apply refuses a non-local/production target without the intent flag
 * (C155) and demands the declared TEQO_ENV matching the exact database name
 * (C195/C231); a remote target also demands the complete S3_* set; the vision
 * endpoint must be on the private network unless ARCHIVE_VISION_ALLOW_REMOTE=1
 * is declared (PII guardrail). The engine config lives in ARCHIVE_VISION_*
 * (env only, never the repo).
 *
 * Runbook: on the homeserver, inside the compose maintenance service with the
 * stack env file — see docs/ops/teqo-1313-deploy.md.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

import {
  ARCHIVE_VISION_SYSTEM_PROMPT,
  buildArchiveVisionPrompt,
  parseArchiveVisionOutput,
} from '../src/lib/archivePhotoCatalog.ts'

import {
  ARCHIVE_CATALOG_DEFAULT_OUT_DIR,
  archiveCatalogReportStamp,
  formatArchiveCatalogInventory,
  formatArchiveCatalogReport,
  parseArchiveCatalogCliArgs,
  summarizeArchiveCatalogInventory,
  summarizeArchiveCatalogResults,
} from './lib/archiveCatalogPlan.mjs'
import { analyzeArchivePhotoVision } from './lib/archiveVisionApi.mjs'
import {
  TEQO_ENV_DATABASE_BY_ENV,
  assertEnvironmentDatabaseTarget,
  assertLocalVisionEndpoint,
  assertWriteConfirm,
  databaseTarget,
  dieWithLabel,
  isPrivateVisionHost,
  loadCliEnv,
  mirroredMediaRequired,
} from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('archive:catalog')

const WRITE_CONFIRM_FLAG = 'ARCHIVE_CATALOG_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm archive:catalog [opções]

Pré-cataloga as fotos do acervo privado (C231) com o engine de visão local: por
foto, legenda/descrição, atividade/cena, texto visível, temas do vocabulário
existente, município pelo gazetteer e pessoas públicas do catálogo curado.
A curadoria da assessoria vence: campo curado nunca é sobrescrito. Reexecutar
converge ("processadas / puladas / falharam com motivo") e nada é publicado.

Modos (mutuamente exclusivos; o default é o plano):
  (sem flag)         plano/dry-run — lista a fila pendente; sem engine nem escrita
  --apply            cataloga as fotos pendentes (engine local + escrita transacional)
  --verify           inventário read-only da catalogação (sem engine)

Opções:
  --limit <n>        --apply: processa no máximo n fotos (canário); no plano, só limita a prévia
  --out <dir>        diretório dos recibos (default ${ARCHIVE_CATALOG_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  ARCHIVE_VISION_BASE_URL  endpoint OpenAI-compatible do engine (ex.: http://100.94.122.26:11434/v1)
  ARCHIVE_VISION_MODEL     modelo de visão (ex.: qwen2.5vl:7b)
  ARCHIVE_VISION_API_KEY   opcional, quando o servidor local exige chave
  DATABASE_URL             alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1, TEQO_ENV=${envLines}
casando o banco exato, as quatro envs S3_* e o engine na rede privada (host
público exige ARCHIVE_VISION_ALLOW_REMOTE=1). O plano e o --verify são read-only.
`

/** Renders the configured engine without calling it (plan/verify banner). */
const configuredEngine = () => {
  const raw = String(process.env.ARCHIVE_VISION_BASE_URL ?? '').trim()
  if (raw === '') return null
  try {
    const host = new URL(raw).hostname
    return {
      host,
      scope: isPrivateVisionHost(host) ? 'local' : 'remote',
      model: String(process.env.ARCHIVE_VISION_MODEL ?? '').trim() || '(não definido)',
    }
  } catch {
    return null
  }
}

const writeReport = async (options, report, suffix = '') => {
  const stamp = archiveCatalogReportStamp(report.runAt)
  const reportPath = join(options.out, 'reports', `archive-catalog-${stamp}${suffix}.json`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  return reportPath
}

async function main() {
  const options = parseArchiveCatalogCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  const mode = options.apply ? 'apply' : options.verify ? 'verify' : 'plan'
  const runAt = new Date().toISOString()
  console.log(`[archive:catalog] alvo: ${databaseTarget()} | modo: ${mode}`)

  let engine = configuredEngine()
  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'archive:catalog',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm archive:catalog --apply',
    })
    assertEnvironmentDatabaseTarget()
    const { resolveS3StorageEnv } = await import('../src/utilities/mediaStorage.ts')
    const storage = resolveS3StorageEnv(process.env)
    if (mirroredMediaRequired({ s3Enabled: storage.enabled })) {
      die(
        'escrita em produção/remoto exige mídia espelhada: configure S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY; sem elas o acervo não está acessível no alvo.',
      )
    }
    const { scope, host } = assertLocalVisionEndpoint()
    const model = String(process.env.ARCHIVE_VISION_MODEL ?? '').trim()
    if (model === '') {
      die('ARCHIVE_VISION_MODEL ausente — informe o modelo de visão (ex.: qwen2.5vl:7b).')
    }
    engine = { host, scope, model }
  }

  const config = (await import('../src/payload.config.ts')).default
  const { listArchivePhotos } = await import('../src/utilities/flickr/archivePhotoIngest.ts')
  const { catalogArchivePhoto, listArchivePhotoCatalogQueue } =
    await import('../src/utilities/flickr/archivePhotoCatalog.ts')
  const payload = await getPayload({ config })
  const startedAt = Date.now()

  if (mode === 'verify') {
    const rows = await listArchivePhotos(payload)
    const inventory = summarizeArchiveCatalogInventory(rows)
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      engine,
      ...inventory,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report, '-verify')
    for (const line of formatArchiveCatalogInventory(inventory)) console.log(line)
    console.log(`\n[archive:catalog] recibo JSON: ${reportPath}`)
    if (inventory.missingFilename.length > 0) {
      die(
        `${inventory.missingFilename.length} foto(s) sem arquivo armazenado — acervo inconsistente.`,
      )
    }
    if (inventory.pending > 0) {
      die(`${inventory.pending} foto(s) ainda pendentes de catalogação — rode o --apply.`)
    }
    process.exit(0)
  }

  if (mode === 'plan') {
    // The plan always reports the TRUE pending count; `--limit` only caps the
    // preview (the apply mode is where it caps the work).
    const pending = await listArchivePhotoCatalogQueue({ payload })
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      engine,
      pending: pending.length,
      photos: pending.slice(0, options.limit ?? 50).map((item) => ({
        flickrId: item.flickrId,
        title: item.title,
        takenAt: item.takenAt,
      })),
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatArchiveCatalogReport(report)) console.log(line)
    console.log(`\n[archive:catalog] recibo JSON: ${reportPath}`)
    process.exit(0)
  }

  const queue = await listArchivePhotoCatalogQueue({ payload, limit: options.limit })
  console.log(`[archive:catalog] fila: ${queue.length} foto(s) pendente(s)`)

  /**
   * The engine seam: one HTTP call + the fail-closed parse against the closed
   * vocabularies. A transport error or an off-contract answer throws and the
   * pipeline turns it into a named failure — never a write.
   */
  const analyze = async ({ imageDataUrl }) => {
    const content = await analyzeArchivePhotoVision({
      baseUrl: process.env.ARCHIVE_VISION_BASE_URL,
      model: process.env.ARCHIVE_VISION_MODEL,
      apiKey: process.env.ARCHIVE_VISION_API_KEY,
      imageDataUrl,
      prompt: buildArchiveVisionPrompt(),
      systemPrompt: ARCHIVE_VISION_SYSTEM_PROMPT,
    })
    const suggestion = parseArchiveVisionOutput(content)
    if (!suggestion) {
      throw new Error('resposta do engine fora do contrato JSON da catalogação')
    }
    return suggestion
  }

  const results = []
  for (const item of queue) {
    const result = await catalogArchivePhoto({ payload, item, analyze })
    results.push({ flickrId: item.flickrId, ...result })
    const detail =
      result.status === 'cataloged'
        ? ` (${result.source})`
        : result.status === 'failed'
          ? ` [${result.stage}]: ${result.error}`
          : ''
    console.log(`[archive:catalog]   ${result.status}${detail} ${item.flickrId}`)
  }

  const summary = summarizeArchiveCatalogResults(results)
  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    engine,
    summary,
    results: results.map((result) => ({
      flickrId: result.flickrId,
      status: result.status,
      source: result.source ?? null,
      stage: result.stage ?? null,
      error: result.error ?? null,
    })),
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatArchiveCatalogReport(report)) console.log(line)
  console.log(`\n[archive:catalog] recibo JSON: ${reportPath}`)

  if (summary.cataloged === 0 && results.length > 0) {
    die('nenhuma foto foi catalogada — falhas listadas no recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
