/**
 * C229 — builds/updates the semantic index of the speech acervo (`pnpm
 * acervo:index`). It plans the retrieval units of every speech (ASR segments
 * or text windows), embeds only what changed — idempotent by content hash +
 * model — writes the vectors in one transaction per speech and prints an honest
 * report (indexed/skipped/failed/units/tokens/cost). `--probe "<tema>"` is the
 * read-only calibration: it embeds one query and prints the top-N indexed
 * speeches with their cosine, without writing to the database.
 *
 * The corpus and the provider live on the homeserver: run this after the Câmara
 * backfill or a web round (see `docs/ops/teqo-1313-deploy.md` §C155/§C225), and
 * pass `ACERVO_INDEX_CONFIRM=1` when the target is not provably local (the
 * homeserver runs with `NODE_ENV=production` behind the socat proxy).
 *
 * Usage:
 *   pnpm acervo:index --dry-run
 *   pnpm acervo:index --source web --limit 20
 *   ACERVO_INDEX_CONFIRM=1 pnpm acervo:index --source all
 *   ACERVO_INDEX_CONFIRM=1 pnpm acervo:index --force
 *   pnpm acervo:index --probe "combate à oposição" --top 10
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'
import { assertWriteConfirm, databaseTarget, dieWithLabel, loadCliEnv } from './lib/cli.mjs'
import {
  ACERVO_INDEX_CONFIRM_FLAG,
  formatSpeechIndexProbe,
  formatSpeechIndexReport,
  parseSpeechIndexArgs,
  speechIndexCostUsd,
  speechIndexEstimatedBytes,
  speechIndexReportStamp,
} from './lib/speechIndex.mjs'

loadCliEnv()

const die = dieWithLabel('acervo:index')

const config = (await import('../src/payload.config.ts')).default
const {
  DEEPINFRA_EMBED_COST_PER_MILLION_TOKENS_USD,
  DEEPINFRA_EMBED_DIMENSIONS,
  DEEPINFRA_EMBED_MODEL,
  embedSpeechQuery,
} = await import('../src/utilities/ai/deepInfraEmbed.ts')
const { indexSpeechSources, planSpeechIndexBatch, probeSpeechIndex, previewSpeechIndex } =
  await import('../src/utilities/speech/speechEmbeddingIndex.ts')

const HELP = `
Uso: pnpm acervo:index [opções]

Constrói/atualiza o índice vetorial do acervo de falas (Câmara + internet) e
relata o que entrou. Idempotente por hash de conteúdo + modelo: reexecutar só
paga o que mudou. Após os imports (C155/C225), rode este passo.

Opções:
  --source <all|camara|web>  recorte do acervo (default all)
  --limit <n>                processa no máximo n falas
  --dry-run                  planeja sem chamar o provedor nem escrever
  --force                    reindexa mesmo com hash atual
  --probe <tema>             read-only: top-N por similaridade (calibração)
  --top <n>                  quantos no probe (default 10)
  --out <dir>                diretório dos relatórios (default data/acervo-index)
  --help                     esta ajuda

Escrita em alvo não-local, com NODE_ENV=production ou com ALLOW_REMOTE_DB exige
${ACERVO_INDEX_CONFIRM_FLAG}=1. O probe é read-only e não exige a flag.
`

/** Every speech of the recorte with its segments, in one pass per collection. */
const loadSources = async (payload, { source, limit }) => {
  const where = source === 'all' ? {} : { origin: { equals: source } }
  const speeches = await payload.find({
    collection: 'speech',
    where,
    depth: 0,
    ...(limit ? { limit, page: 1 } : { limit: 0, pagination: false }),
    sort: 'speechAt',
    select: { sourceKey: true, officialTranscript: true, summary: true, searchText: true },
    // Intentional bypass: the index CLI is a trusted actor with no session.
    overrideAccess: true,
  })
  const ids = speeches.docs.map((speech) => speech.id)

  const segmentsBySpeech = new Map()
  if (ids.length > 0) {
    const segments = await payload.find({
      collection: 'speechSegment',
      where: { speech: { in: ids } },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'order',
      select: { speech: true, order: true, startSeconds: true, text: true },
      // Intentional bypass: same trusted read.
      overrideAccess: true,
    })
    for (const segment of segments.docs) {
      const speechId = typeof segment.speech === 'number' ? segment.speech : segment.speech?.id
      const list = segmentsBySpeech.get(speechId) ?? []
      list.push({
        order: segment.order,
        startSeconds: segment.startSeconds,
        text: segment.text,
      })
      segmentsBySpeech.set(speechId, list)
    }
  }

  const sources = speeches.docs.map((speech) => ({
    id: speech.id,
    sourceKey: speech.sourceKey,
    officialTranscript: speech.officialTranscript,
    summary: speech.summary,
    searchText: speech.searchText,
    segments: segmentsBySpeech.get(speech.id) ?? [],
  }))
  return sources
}

const writeReport = async (options, report) => {
  const reportPath = join(
    options.out,
    'reports',
    `acervo-index-${speechIndexReportStamp(report.runAt)}.json`,
  )
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  return reportPath
}

async function main() {
  const options = parseSpeechIndexArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  assertLocalDatabase(
    'acervo:index',
    'O índice escreve no acervo; produção exige ' + `${ACERVO_INDEX_CONFIRM_FLAG}=1.`,
  )
  if (!options.probe && !options.dryRun) {
    assertWriteConfirm({
      label: 'acervo:index',
      flag: ACERVO_INDEX_CONFIRM_FLAG,
      command: 'pnpm acervo:index',
    })
  }

  const payload = await getPayload({ config })

  if (options.probe) {
    const queryVector = await embedSpeechQuery(options.probe)
    if (!queryVector) {
      die('não foi possível vetorizar o tema (DEEPINFRA_API_KEY ausente ou provedor fora).')
    }
    const hits = await probeSpeechIndex(payload, queryVector, { limit: options.top })
    for (const line of formatSpeechIndexProbe(options.probe, hits)) console.log(line)
    process.exit(0)
  }

  const runAt = new Date().toISOString()
  const startedAt = Date.now()
  const sources = await loadSources(payload, options)
  console.log(
    `[acervo:index] alvo: ${databaseTarget()} | modo: ${options.dryRun ? 'dry-run (read-only)' : 'index'} | fonte: ${options.source} | falas no recorte: ${sources.length}`,
  )

  if (options.dryRun) {
    const batch = await planSpeechIndexBatch(payload, sources, { force: options.force })
    const preview = previewSpeechIndex(batch, sources.length)
    const report = {
      runAt,
      mode: 'dry-run',
      target: databaseTarget(),
      source: options.source,
      model: DEEPINFRA_EMBED_MODEL,
      ...preview,
      estimatedBytes: speechIndexEstimatedBytes(preview.units, DEEPINFRA_EMBED_DIMENSIONS),
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatSpeechIndexReport(report)) console.log(line)
    console.log(`\n[acervo:index] relatório JSON: ${reportPath}`)
    process.exit(0)
  }

  const result = await indexSpeechSources(payload, sources, { force: options.force })
  const report = {
    runAt,
    mode: 'index',
    target: databaseTarget(),
    source: options.source,
    model: DEEPINFRA_EMBED_MODEL,
    speeches: sources.length,
    upToDate: result.upToDate,
    skippedNoText: result.skippedNoText,
    toIndex: result.indexed + result.failed,
    indexed: result.indexed,
    failed: result.failed,
    units: result.units,
    estimatedBytes: speechIndexEstimatedBytes(result.units, DEEPINFRA_EMBED_DIMENSIONS),
    promptTokens: result.promptTokens,
    costUsd: speechIndexCostUsd(result.promptTokens, DEEPINFRA_EMBED_COST_PER_MILLION_TOKENS_USD),
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatSpeechIndexReport(report)) console.log(line)
  console.log(`\n[acervo:index] relatório JSON: ${reportPath}`)

  if (result.failed > 0 && result.indexed === 0) {
    die('nenhuma fala foi indexada — falhas listadas no relatório.')
  }
  process.exit(0)
}

main().catch((error) => {
  die(error?.message || String(error))
})
