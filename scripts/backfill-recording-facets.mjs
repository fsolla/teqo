/**
 * C219 — facet backfill of the uploaded recordings ("Gravações enviadas").
 *
 * The transcription job classifies every recording it finishes; this CLI
 * classifies the rows that already existed (and can reclassify on demand) with
 * the SAME function the job uses (`classifyRecordingFacets` → `classifySpeech`:
 * offline gazetteer + one validated LLM refinement on Deep Infra). It never
 * invents provenance: a row is only written when the classifier produced a
 * result, a `manual` curation is never touched, and the default selection is
 * exactly the rows with no `classifiedBy` (never classified).
 *
 * Idempotent: re-running skips what it already classified (default mode);
 * `--all` reclassifies everything except `manual` rows.
 *
 * The local-DB guard refuses a non-local DATABASE_URL, and any write run
 * targeting production (or a remote/override DB) additionally requires
 * `RECORDING_CLASSIFY_CONFIRM=1` (same family as `CAMARA_IMPORT_CONFIRM`).
 *
 * Usage:
 *   pnpm recordings:classify --dry-run
 *   pnpm recordings:classify --limit 5
 *   pnpm recordings:classify
 *   pnpm recordings:classify --all
 *   RECORDING_CLASSIFY_CONFIRM=1 pnpm recordings:classify --all
 */
import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'
import { dieWithLabel, isTruthyEnv, loadCliEnv, requiresWriteConfirm } from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('recordings:classify')
const WRITE_CONFIRM_FLAG = 'RECORDING_CLASSIFY_CONFIRM'

const parseArgs = (argv) => {
  const options = { dryRun: false, all: false, limit: null }
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--all') options.all = true
    else if (arg.startsWith('--limit=')) {
      const limit = Number(arg.slice('--limit='.length))
      if (!Number.isSafeInteger(limit) || limit <= 0) die(`--limit inválido: ${arg}`)
      options.limit = limit
    } else die(`argumento desconhecido: ${arg}`)
  }
  return options
}

const options = parseArgs(process.argv.slice(2))

assertLocalDatabase(
  'recordings:classify',
  'A classificação escreve em `recording`; aponte DATABASE_URL para o banco local.',
)

if (requiresWriteConfirm() && !isTruthyEnv(process.env[WRITE_CONFIRM_FLAG])) {
  die(
    `Este run escreve em um banco remoto/de produção. Se é isso mesmo, re-execute com:\n  ${WRITE_CONFIRM_FLAG}=1 pnpm recordings:classify …`,
  )
}

const config = (await import('../src/payload.config.ts')).default
const { classifyRecordingFacets, recordingFacetWriteData } =
  await import('../src/utilities/recordings/recordingClassification.ts')

const payload = await getPayload({ config })

const where = options.all
  ? { and: [{ status: { equals: 'ready' } }, { classifiedBy: { not_equals: 'manual' } }] }
  : { and: [{ status: { equals: 'ready' } }, { classifiedBy: { exists: false } }] }

const targets = await payload.find({
  collection: 'recording',
  where,
  depth: 0,
  limit: options.limit ?? 0,
  pagination: false,
  sort: 'createdAt',
  select: { title: true, classifiedBy: true },
  // Intentional admin bypass: the backfill CLI is a trusted actor with no session.
  overrideAccess: true,
})

const report = {
  targets: targets.docs.length,
  classified: 0,
  skippedEmptyTranscript: 0,
  failed: 0,
  llmUsed: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
}

console.log(
  `[recordings:classify] ${report.targets} gravação(ões) alvo${options.dryRun ? ' (dry-run)' : ''}.`,
)

for (const recording of targets.docs) {
  const segments = await payload.find({
    collection: 'recordingSegment',
    where: { recording: { equals: recording.id } },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'order',
    select: { text: true },
    // Intentional admin bypass: reconstructing the transcript the job owns.
    overrideAccess: true,
  })
  const transcript = segments.docs.map((segment) => segment.text).join(' ')

  const classification = await classifyRecordingFacets({ payload, transcript })
  if (!classification) {
    report.skippedEmptyTranscript += 1
    console.warn(`[recordings:classify] #${recording.id} sem transcrição utilizável — pulada.`)
    continue
  }

  if (classification.llm.used) report.llmUsed += 1
  if (classification.llm.totalTokens !== null) report.totalTokens += classification.llm.totalTokens
  if (classification.llm.estimatedCostUsd !== null) {
    report.estimatedCostUsd += classification.llm.estimatedCostUsd
  }

  if (options.dryRun) {
    report.classified += 1
    console.log(
      `[recordings:classify] (dry-run) #${recording.id} "${recording.title}" → ` +
        `${classification.topics.join(', ') || '—'} · ${classification.classifiedBy}`,
    )
    continue
  }

  try {
    await payload.update({
      collection: 'recording',
      id: recording.id,
      data: recordingFacetWriteData(classification),
      // Intentional admin bypass: the backfill CLI is a trusted actor with no session.
      overrideAccess: true,
    })
    report.classified += 1
    console.log(
      `[recordings:classify] #${recording.id} "${recording.title}" → ` +
        `${classification.topics.join(', ') || '—'} · ${classification.classifiedBy}`,
    )
  } catch (error) {
    report.failed += 1
    console.warn(
      `[recordings:classify] #${recording.id} falhou ao gravar: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

console.log(
  `\n[recordings:classify] alvos=${report.targets} classificadas=${report.classified} ` +
    `sem-transcrição=${report.skippedEmptyTranscript} falhas=${report.failed} ` +
    `llm=${report.llmUsed} tokens=${report.totalTokens} custo≈$${report.estimatedCostUsd.toFixed(4)}`,
)
process.exit(report.failed > 0 ? 1 : 0)
