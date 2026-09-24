/**
 * C215 — ingests a batch of web-speech findings (the discovery output of C218)
 * into the acervo: validate the batch → acquire the media (yt-dlp for
 * YouTube/Instagram, direct HTTP for radio/audio) → transcribe with timestamps
 * → classify → mirror the artifact privately → upsert idempotently. Re-running
 * never duplicates and never overwrites a manual facet curation; every run
 * prints and writes an honest report (found/new/updated/skipped/failures,
 * time and ASR cost).
 *
 * The report lands under `data/falas-web/reports/` (gitignored); the mirrored
 * media goes to the private collection (temp files are removed after each
 * finding). The local-DB guard refuses a non-local DATABASE_URL, and any write
 * run targeting production (or a remote/override DB) additionally requires
 * `FALAS_WEB_IMPORT_CONFIRM=1`.
 *
 * Usage:
 *   pnpm falas-web:import --findings data/falas-web/lote.json
 *   pnpm falas-web:import --findings lote.json --dry-run
 *   pnpm falas-web:import --findings lote.json --limit 3
 *   pnpm falas-web:import --findings lote.json --reprocess
 *   FALAS_WEB_IMPORT_CONFIRM=1 pnpm falas-web:import --findings lote.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'
import { assertWriteConfirm, databaseTarget, dieWithLabel, loadCliEnv } from './lib/cli.mjs'
import { resolveFfmpeg } from './lib/mediaBinaries.mjs'
import {
  formatWebSpeechReport,
  planWebSpeechBatch,
  summarizePlannedActions,
  summarizeWebSpeechResults,
  webSpeechPlannedAction,
  webSpeechReportStamp,
} from './lib/webSpeeches.mjs'

loadCliEnv()

const die = dieWithLabel('falas-web:import')

const config = (await import('../src/payload.config.ts')).default
const { parseWebSpeechBatch } = await import('../src/lib/webSpeech.ts')
const { findSpeechImportState } = await import('../src/utilities/speech/speechImport.ts')
const { ingestWebSpeech } = await import('../src/utilities/speech/webSpeechIngest.ts')

const WRITE_CONFIRM_FLAG = 'FALAS_WEB_IMPORT_CONFIRM'
const DEFAULT_OUT_DIR = 'data/falas-web'

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
  const options = {
    findings: null,
    out: DEFAULT_OUT_DIR,
    limit: null,
    dryRun: false,
    reprocess: false,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined || next.startsWith('--')) die(`faltou valor para ${arg}.`)
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--findings') options.findings = value()
    else if (arg === '--out') options.out = value()
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--reprocess') options.reprocess = true
    else die(`argumento desconhecido: ${arg}`)
  }
  if (options.help) return options
  if (!options.findings) die('informe --findings <arquivo.json> (veja --help).')
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    die('--limit deve ser >= 1.')
  }
  if (options.out.includes('..')) die('--out não pode escapar do diretório do repo (sem "..").')
  return options
}

const HELP = `
Uso: pnpm falas-web:import --findings <arquivo.json> [opções]

O lote é o JSON da descoberta (C218): { generatedAt?, findings: [...] }.
Cada achado: platform (youtube|instagram|radio|audio), url, publishedAt e —
para radio|audio — mediaUrl (arquivo direto). externalId/title/channel/
durationSeconds/thumbnailUrl são opcionais e o yt-dlp completa lacunas.

Opções:
  --findings <arquivo>  lote de achados (obrigatório)
  --out <dir>           diretório dos relatórios (default data/falas-web)
  --limit <n>           processa no máximo n achados
  --dry-run             planeja o lote (lê o catálogo) sem baixar nem escrever
  --reprocess           refaz download/transcrição mesmo com item completo
  --help                esta ajuda

Sucesso parcial sai com código 0 (as falhas ficam no relatório); código 1
quando nenhum achado entrou no catálogo.

Escrita em alvo não-local ou com NODE_ENV=production exige
${WRITE_CONFIRM_FLAG}=1. O binário do yt-dlp vem de YTDLP_PATH ou do PATH;
instale com \`pipx install yt-dlp\` (o ffmpeg empacotado é usado se não houver
no PATH).
`

const writeReport = async (options, report) => {
  const reportPath = join(
    options.out,
    'reports',
    `falas-web-${webSpeechReportStamp(report.runAt)}.json`,
  )
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  return reportPath
}

/** The packaged ffmpeg fallback keeps the operator flow working without a system binary. */
const ensureFfmpeg = async () => {
  if (process.env.FFMPEG_PATH?.trim()) return
  const resolved = await resolveFfmpeg({
    audio: true,
    filters: [],
    requirementsLabel: 'libmp3lame para extrair o áudio',
  })
  process.env.FFMPEG_PATH = resolved.bin
  console.log(`[falas-web:import] ffmpeg: ${resolved.bin} (${resolved.source})`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (options.dryRun) {
    if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  } else {
    assertWriteConfirm({
      label: 'falas-web:import',
      flag: WRITE_CONFIRM_FLAG,
      command: 'pnpm falas-web:import',
    })
    assertLocalDatabase(
      'falas-web:import',
      `A ingestão escreve no acervo; produção exige ${WRITE_CONFIRM_FLAG}=1.`,
    )
  }
  console.log(
    `[falas-web:import] alvo: ${databaseTarget()} | modo: ${options.dryRun ? 'dry-run (read-only)' : options.reprocess ? 'import (--reprocess)' : 'import'}`,
  )

  const envelope = parseWebSpeechBatch(JSON.parse(await readFile(options.findings, 'utf8')))
  if (!envelope.ok) die(envelope.error)
  const plan = planWebSpeechBatch(envelope.batch.findings)
  const entries = options.limit ? plan.entries.slice(0, options.limit) : plan.entries
  if (envelope.batch.findings.length > 0 && entries.length === 0) {
    die('nenhum achado válido no lote — corrija o JSON (inválidos/duplicados no relatório).')
  }
  const runAt = new Date().toISOString()

  const payload = await getPayload({ config })
  const startedAt = Date.now()

  if (options.dryRun) {
    const planned = []
    for (const entry of entries) {
      const state = await findSpeechImportState(payload, entry.sourceKey)
      planned.push({
        sourceKey: entry.sourceKey,
        platform: entry.finding.platform,
        action: webSpeechPlannedAction(state, options.reprocess),
      })
    }
    const report = {
      runAt,
      mode: 'dry-run',
      batchGeneratedAt: envelope.batch.generatedAt,
      findings: envelope.batch.findings.length,
      planned: entries.length,
      invalid: plan.invalid,
      duplicates: plan.duplicates,
      plannedActions: summarizePlannedActions(planned),
      plannedEntries: planned,
      durationMs: Date.now() - startedAt,
    }
    const reportPath = await writeReport(options, report)
    for (const line of formatWebSpeechReport({ ...report, failures: [] })) console.log(line)
    console.log(`\n[falas-web:import] relatório JSON: ${reportPath}`)
    process.exit(0)
  }

  await ensureFfmpeg()

  const results = []
  for (const entry of entries) {
    console.log(`[falas-web:import] ${entry.sourceKey}`)
    const result = await ingestWebSpeech(payload, entry.finding, { reprocess: options.reprocess })
    results.push(result)
    console.log(
      `  → ${result.status}${result.stage ? ` (${result.stage})` : ''}${result.error ? `: ${result.error}` : ''}`,
    )
  }

  const summary = summarizeWebSpeechResults(results)
  const report = {
    runAt,
    mode: 'import',
    batchGeneratedAt: envelope.batch.generatedAt,
    findings: envelope.batch.findings.length,
    planned: entries.length,
    invalid: plan.invalid,
    duplicates: plan.duplicates,
    reprocess: options.reprocess,
    ...summary,
    durationMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, report)
  for (const line of formatWebSpeechReport(report)) console.log(line)
  console.log(`\n[falas-web:import] relatório JSON: ${reportPath}`)

  const succeeded = summary.created + summary.updated + summary.skipped
  if (summary.failed > 0 && succeeded === 0) {
    die('nenhum achado entrou no catálogo — falhas listadas no relatório.')
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  die(error?.message || String(error))
})
