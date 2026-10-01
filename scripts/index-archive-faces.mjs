/**
 * C242 — indexes the approved photo archive for the selfie search: each photo
 * is downloaded from the private storage, prepared small and handed to the SAME
 * face-api engine the browser runs; the descriptors of every detected face are
 * PERSISTED as anonymous rows in `archivePhotoFace` (scope B, decision of
 * 2026-10-01: any visitor can find themselves; no identity, no score).
 *
 * Modes:
 *   pnpm faces:index                plan/dry-run (default) — the queue; no engine, no write
 *   pnpm faces:index --apply        processes the queue; requires
 *                                   FACE_INDEX_CONFIRM=1 outside local dev, the
 *                                   declared TEQO_ENV and the complete S3_* set
 *                                   when the target media is remote
 *   pnpm faces:index --verify       read-only inventory (indexed/stale/descriptors)
 *
 * Options: --limit <n> (canary), --refresh (ignores the marker), --out <dir>
 * (receipts, default `data/face`), --help.
 *
 * Runbook: on the workstation, against the stack env — see
 * docs/ops/teqo-1313-deploy.md.
 */
import { join } from 'node:path'

import { getPayload } from 'payload'

import { FACE_SEARCH_MODEL } from '../src/lib/faceSearch.ts'

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
import { createNodeFaceEngine } from './lib/faceEngine.mjs'
import {
  FACE_INDEX_DEFAULT_OUT_DIR,
  faceIndexReportStamp,
  formatFaceIndexInventory,
  formatFaceIndexReport,
  parseFaceIndexCliArgs,
  summarizeFaceIndexInventory,
  summarizeFaceIndexResults,
} from './lib/faceIndexPlan.mjs'

loadCliEnv()

const die = dieWithLabel('faces:index')

const WRITE_CONFIRM_FLAG = 'FACE_INDEX_CONFIRM'

const envLines = Object.entries(TEQO_ENV_DATABASE_BY_ENV)
  .map(([environment, database]) => `${environment} (${database})`)
  .join(' | ')

const HELP = `
Uso: pnpm faces:index [opções]

Indexa as fotos APROVADAS do acervo para a busca por selfie: por foto, detecta
os rostos com os mesmos modelos do navegador e grava os descritores como linhas
anônimas (foto + vetor + modelo) em archivePhotoFace. Não há nome nem vínculo
com pessoa; a busca responde só com fotos.

Modos (mutuamente exclusivos; o default é o plano):
  (sem flag)         plano/dry-run — fila e revisão; sem engine nem escrita
  --apply            processa a fila (engine local + escrita transacional)
  --verify           inventário read-only (indexadas/desatualizadas/rostos)

Opções:
  --limit <n>        --apply: processa no máximo n fotos (canário)
  --refresh          ignora o marcador de revisão e reprocessa tudo
  --out <dir>        diretório dos recibos (default ${FACE_INDEX_DEFAULT_OUT_DIR})
  --help             esta ajuda

Ambiente:
  DATABASE_URL       alvo (obrigatório em todos os modos)

--apply em alvo não-local/produção exige ${WRITE_CONFIRM_FLAG}=1, TEQO_ENV=${envLines}
casando o banco exato e as quatro envs S3_* quando a mídia for remota. O plano e o
--verify são read-only.
`

const writeReport = async (options, report, suffix = '') => {
  const stamp = faceIndexReportStamp(report.runAt)
  const relativePath = join(options.out, 'reports', `face-index-${stamp}${suffix}.json`)
  const body = JSON.stringify(report, null, 2)
  await writeRepoFile({
    label: 'faces:index',
    root: process.cwd(),
    relativePath,
    body,
  })
  return join(process.cwd(), relativePath)
}

async function main() {
  const options = parseFaceIndexCliArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')

  const mode = options.apply ? 'apply' : options.verify ? 'verify' : 'plan'
  const runAt = new Date().toISOString()
  console.log(`[faces:index] alvo: ${databaseTarget()} | modo: ${mode}`)

  if (mode === 'apply') {
    assertWriteConfirm({
      label: 'faces:index',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm faces:index --apply',
    })
    assertEnvironmentDatabaseTarget()
    const { resolveS3StorageEnv } = await import('../src/utilities/mediaStorage.ts')
    const storage = resolveS3StorageEnv(process.env)
    if (mirroredMediaRequired({ s3Enabled: storage.enabled })) {
      die(
        'escrita em produção/remoto exige mídia espelhada: configure S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY; sem elas o acervo não está acessível no alvo.',
      )
    }
  }

  const config = (await import('../src/payload.config.ts')).default
  const { listArchivePhotoFaceIndexQueue, indexArchivePhotoFaces } =
    await import('../src/utilities/faceIndex/faceDescriptorIndex.ts')

  const payload = await getPayload({ config })
  const startedAt = Date.now()

  if (mode === 'verify') {
    const [queue, descriptors] = await Promise.all([
      listArchivePhotoFaceIndexQueue({ payload }),
      payload.count({
        collection: 'archivePhotoFace',
        where: { model: { equals: FACE_SEARCH_MODEL } },
        // Intentional bypass: the batch CLI is a trusted operator with no session.
        overrideAccess: true,
      }),
    ])
    const inventory = summarizeFaceIndexInventory({ queue, descriptors: descriptors.totalDocs })
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      model: FACE_SEARCH_MODEL,
      ...inventory,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report, '-verify')
    for (const line of formatFaceIndexInventory(inventory, FACE_SEARCH_MODEL)) console.log(line)
    console.log(`\n[faces:index] recibo JSON: ${reportPath}`)

    if (inventory.stale > 0) {
      die(`${inventory.stale} foto(s) desatualizada(s) — rode o --apply`)
    }
    process.exit(0)
  }

  const queue = await listArchivePhotoFaceIndexQueue({
    payload,
    refresh: options.refresh,
    limit: mode === 'plan' ? undefined : (options.limit ?? undefined),
  })

  if (mode === 'plan') {
    const report = {
      runAt,
      mode,
      target: databaseTarget(),
      model: FACE_SEARCH_MODEL,
      queue: {
        indexKey: queue.indexKey,
        totalApproved: queue.totalApproved,
        stale: queue.stale,
        items: queue.items.length,
      },
      summary: { indexed: 0, failed: 0, descriptors: 0, failures: [] },
      preview: queue.items.slice(0, options.limit ?? 20).map((item) => ({ photoId: item.id })),
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatFaceIndexReport(report)) console.log(line)
    console.log(`\n[faces:index] recibo JSON: ${reportPath}`)
    process.exit(0)
  }

  if (queue.items.length === 0) {
    console.log('[faces:index] nada a fazer — todas as fotos aprovadas estão na revisão atual.')
    process.exit(0)
  }

  const engine = await createNodeFaceEngine(process.cwd()).catch((error) => {
    die(error.message)
  })

  const results = []
  for (const item of queue.items) {
    const result = await indexArchivePhotoFaces({
      payload,
      item,
      indexKey: queue.indexKey,
      analyze: engine.detectPixels,
    })
    results.push({ photoId: item.id, ...result })
    const detail =
      result.status === 'failed'
        ? ` [${result.stage}]: ${result.error}`
        : result.descriptorCount > 0
          ? ` → ${result.descriptorCount} rosto(s)`
          : ''
    console.log(`[faces:index]   ${result.status}${detail} foto ${item.id}`)
  }

  const summary = summarizeFaceIndexResults(results)
  const report = {
    runAt,
    mode,
    target: databaseTarget(),
    model: FACE_SEARCH_MODEL,
    queue: {
      indexKey: queue.indexKey,
      totalApproved: queue.totalApproved,
      stale: queue.stale,
      items: queue.items.length,
    },
    summary,
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatFaceIndexReport(report)) console.log(line)
  console.log(`\n[faces:index] recibo JSON: ${reportPath}`)

  if (summary.indexed === 0 && results.length > 0) {
    die('nenhuma foto foi processada com sucesso — falhas listadas no recibo.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
