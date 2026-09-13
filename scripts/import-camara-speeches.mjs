/**
 * C153 import — populates the speech catalog from the Câmara sources:
 * open-data speeches → event on that date → speaker excerpt on the event page
 * → async VOD → Deep Infra Whisper segments (minutagem) + facet classification
 * (gazetteer + LLM) → idempotent upsert into `speech`/`speechSegment`.
 *
 * Re-running is safe: records are matched by `sourceKey`, metadata is
 * refreshed, VOD/ASR is skipped when the excerpt identity and segments are
 * already stored, and a `manual` facet curation is never overwritten.
 *
 * Media and reports land under `data/camara/` (gitignored). The local-DB guard
 * refuses a non-local DATABASE_URL; production is C155.
 *
 * Usage:
 *   pnpm camara:import --legislature 57
 *   pnpm camara:import --date 2023-02-07 --limit 3
 *   pnpm camara:import --legislature 57 --skip-transcribe
 *   pnpm camara:import --legislature 57 --reclassify
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getPayload } from 'payload'

import { assertLocalDatabase } from './assert-local-database.mjs'
import {
  DEEPINFRA_COST_PER_MINUTE_USD,
  downloadToBuffer,
  eventPageUrl,
  eventsUrl,
  getJson,
  getText,
  resolveVod,
  speechesUrl,
  transcribeSpeechAudio,
} from './lib/camaraFetch.mjs'
import {
  LEGISLATURE_RANGES,
  SOLLA_DEPUTY_ID,
  legislatureForDate,
  matchExcerpt,
  parseDurationToSeconds,
  parseEventExcerpts,
  parseOfficialKeywords,
  parsePresidingOfficerTransitions,
  resolvePresidingOfficer,
  selectSpeechEvents,
  speechDate,
  speechSourceKey,
} from './lib/camaraSpeeches.mjs'
import { dieWithLabel, ensureCachedDownload, loadCliEnv } from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('camara:import')

const config = (await import('../src/payload.config.ts')).default
const { findSpeechImportState, upsertSpeechBundle } =
  await import('../src/utilities/speech/speechImport.ts')
const { classifySpeech } = await import('../src/utilities/speech/speechClassifier.ts')

const DEFAULT_OUT_DIR = 'data/camara'
const MAX_EVENT_CANDIDATES = 5
const EVENT_TYPE_PRIORITY = [
  'Sessão Deliberativa',
  'Breves Comunicações',
  'Sessão Não Deliberativa',
  'Sessão Solene',
  'Outro Evento',
]

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
  const options = {
    legislature: 57,
    date: null,
    limit: null,
    speaker: 'Jorge Solla',
    out: DEFAULT_OUT_DIR,
    skipTranscribe: false,
    reclassify: false,
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
    else if (arg === '--skip-transcribe') options.skipTranscribe = true
    else if (arg === '--reclassify') options.reclassify = true
    else if (arg === '--legislature') options.legislature = Number(value())
    else if (arg === '--date') options.date = value()
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--speaker') options.speaker = value()
    else if (arg === '--out') options.out = value()
    else die(`argumento desconhecido: ${arg}`)
  }
  if (!options.help && !options.date && !LEGISLATURE_RANGES[options.legislature]) {
    die('informe --legislature <54|55|56|57> ou --date <YYYY-MM-DD> (veja --help).')
  }
  if (!options.help && options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    die('--date deve ser YYYY-MM-DD.')
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    die('--limit deve ser >= 1.')
  }
  if (!options.help && options.out.includes('..')) {
    die('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

const HELP = `
Uso: pnpm camara:import [--legislature 54|55|56|57] [--date YYYY-MM-DD] [opções]

Opções:
  --legislature <n>   54|55|56|57 (default 57; ignorado se --date)
  --date <YYYY-MM-DD> discursos de um único dia
  --limit <n>         quantos discursos processar (default: todos)
  --speaker <nome>    nome do orador a casar no evento (default "Jorge Solla")
  --out <dir>         diretório de cache/artefatos (default data/camara)
  --skip-transcribe   não chama a Deep Infra (preserva os segmentos existentes)
  --reclassify        refaz a classificação mesmo já tendo facetas da LLM
  --help              esta ajuda

A página do evento é cacheada em <out>/events; apague-a para reler a Câmara.
`

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

const eventsByDate = new Map()
const eventPages = new Map()

async function getEventsForDate(date) {
  const cached = eventsByDate.get(date)
  if (cached) return cached
  const events = (await getJson(eventsUrl(date))).dados ?? []
  eventsByDate.set(date, events)
  return events
}

async function loadEventPage(eventId, options) {
  const cached = eventPages.get(eventId)
  if (cached) return cached
  const path = join(options.out, 'events', `${eventId}.html`)
  let html
  try {
    html = await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    html = await getText(eventPageUrl(eventId), { timeoutMs: 60_000 })
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, html)
  }
  eventPages.set(eventId, html)
  return html
}

async function fetchSpeeches(deputyId, from, to) {
  const speeches = []
  for (let page = 1; ; page += 1) {
    const body = await getJson(`${speechesUrl(deputyId, from, to)}&pagina=${page}`)
    const batch = body.dados ?? []
    speeches.push(...batch)
    const hasNext = (body.links ?? []).some((link) => link?.rel === 'next')
    if (!hasNext || batch.length === 0) break
  }
  return speeches
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const eventPriority = (event) => {
  const index = EVENT_TYPE_PRIORITY.indexOf(event?.descricaoTipo)
  return index === -1 ? EVENT_TYPE_PRIORITY.length : index
}

/** Nearest event of the speech date, preferred session types first. */
async function resolveSpeechContext(speech, options) {
  const candidates = selectSpeechEvents(
    await getEventsForDate(speechDate(speech.dataHoraInicio)),
    speech.dataHoraInicio,
  )
  const ordered = [...candidates].sort((left, right) => eventPriority(left) - eventPriority(right))
  for (const event of ordered.slice(0, MAX_EVENT_CANDIDATES)) {
    const html = await loadEventPage(event.id, options)
    const excerpt = matchExcerpt(
      parseEventExcerpts(html, event.id),
      speech.dataHoraInicio,
      options.speaker,
    )
    if (excerpt) return { event, html, excerpt }
  }
  return { event: ordered[0] ?? null, html: null, excerpt: null }
}

async function transcribeExcerpt(eventId, excerpt, options) {
  const vod = await resolveVod(eventId, excerpt)
  if (vod.status.state !== 'PRONTO' || !vod.status.video?.downloadUrl) {
    return {
      vodState: vod.status.state,
      failure: `VOD não ficou PRONTO (estado=${vod.status.state})`,
    }
  }

  const cached = await ensureCachedDownload({
    label: 'camara:import',
    key: `${eventId}-${excerpt.audioId}-${excerpt.tMs}`,
    url: vod.status.video.downloadUrl,
    ext: 'mp4',
    cacheDir: options.out,
    download: downloadToBuffer,
  })
  const { transcription, elapsedMs } = await transcribeSpeechAudio(cached.buffer)
  return {
    vodState: vod.status.state,
    segments: transcription.segments.map((segment) => ({
      startSeconds: segment.start,
      endSeconds: segment.end,
      text: segment.text,
    })),
    durationSeconds: transcription.duration,
    playbackUrl: vod.status.video.playbackUrl,
    downloadUrl: vod.status.video.downloadUrl,
    audioSeconds: transcription.duration ?? 0,
    elapsedMs,
  }
}

async function processSpeech(payload, speech, options, run) {
  const sourceKey = speechSourceKey(speech)
  const report = {
    sourceKey,
    speechAt: speech.dataHoraInicio,
    eventId: null,
    excerpt: null,
    vodState: null,
    presidingOfficer: null,
    classifiedBy: null,
    segmentCount: 0,
    created: false,
    manualFacetsPreserved: false,
    failures: [],
  }

  const existing = await findSpeechImportState(payload, sourceKey)
  const keywords = parseOfficialKeywords(speech.keywords)
  const date = speechDate(speech.dataHoraInicio)
  const year = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : null

  let context = { event: null, html: null, excerpt: null }
  try {
    context = await resolveSpeechContext(speech, options)
  } catch (error) {
    report.failures.push({ stage: 'event', message: error?.message ?? String(error) })
  }
  const { event, excerpt } = context
  if (event) report.eventId = event.id
  if (excerpt) {
    report.excerpt = { audioId: excerpt.audioId, tMs: excerpt.tMs, startTime: excerpt.startTime }
  }
  const transitions = context.html ? parsePresidingOfficerTransitions(context.html) : []
  report.presidingOfficer = excerpt ? resolvePresidingOfficer(transitions, excerpt.tMs) : null

  // Identity/media carry-over: a run that failed to resolve the event page must
  // not wipe the stored excerpt or force a re-transcription next time.
  const excerptChanged =
    Boolean(excerpt) &&
    Boolean(existing) &&
    (existing.audioId !== excerpt.audioId || existing.excerptTMs !== excerpt.tMs)
  const preserveStoredMedia = !excerpt || !excerptChanged
  const needsTranscription =
    Boolean(excerpt) &&
    !options.skipTranscribe &&
    (!existing || excerptChanged || existing.segmentCount === 0)

  let media = {}
  if (needsTranscription) {
    try {
      media = await transcribeExcerpt(event.id, excerpt, options)
      if (media.failure) report.failures.push({ stage: 'vod', message: media.failure })
      if (media.segments) {
        run.asr.calls += 1
        run.asr.audioSeconds += media.audioSeconds
        run.asr.elapsedMs += media.elapsedMs ?? 0
      }
    } catch (error) {
      run.asr.failures += 1
      report.failures.push({ stage: 'asr', message: error?.message ?? String(error) })
    }
  }

  const skipClassification =
    existing?.classifiedBy === 'manual' || (existing?.classifiedBy === 'llm' && !options.reclassify)
  let facets
  if (skipClassification) {
    report.classifiedBy = existing.classifiedBy
  } else {
    const classification = await classifySpeech({
      transcript: speech.transcricao ?? '',
      summary: speech.sumario ?? null,
      keywords,
    })
    run.llm.calls += 1
    if (classification.llm.used) {
      facets = classification.facets
      report.classifiedBy = classification.facets.classifiedBy
      run.llm.used += 1
      run.llm.totalTokens += classification.llm.totalTokens ?? 0
      run.llm.estimatedCostUsd += classification.llm.estimatedCostUsd ?? 0
    } else if (existing?.classifiedBy === 'llm') {
      // Never downgrade a stored LLM classification to the gazetteer fallback
      // (that would drop the extracted people/programs/projects).
      report.classifiedBy = existing.classifiedBy
      report.failures.push({
        stage: 'classify',
        message: `LLM indisponível (${classification.llm.error ?? 'erro'}); facetas anteriores preservadas`,
      })
      run.llm.failed += 1
    } else {
      facets = classification.facets
      report.classifiedBy = classification.facets.classifiedBy
      run.llm.failed += 1
      if (classification.llm.error && run.llm.sampleError === null) {
        run.llm.sampleError = classification.llm.error
      }
    }
  }

  const durationSeconds =
    media.durationSeconds ??
    (preserveStoredMedia ? (existing?.durationSeconds ?? null) : null) ??
    parseDurationToSeconds(excerpt?.duration)
  const bundle = {
    sourceKey,
    speechAt: String(speech.dataHoraInicio ?? '').trim(),
    year,
    legislature: legislatureForDate(speech.dataHoraInicio),
    type: speech.tipoDiscurso ?? null,
    phase: speech.faseEvento?.titulo ?? null,
    durationSeconds,
    summary: speech.sumario ?? null,
    officialTranscript: speech.transcricao ?? null,
    officialTextUrl: speech.urlTexto ?? null,
    keywords,
    eventId: event?.id ?? null,
    eventType: event?.descricaoTipo ?? null,
    eventStartAt: event?.dataHoraInicio ?? null,
    eventEndAt: event?.dataHoraFim ?? null,
    youtubeUrl: event?.urlRegistro ?? null,
    presidingOfficer: report.presidingOfficer,
    audioId: excerpt?.audioId ?? (preserveStoredMedia ? (existing?.audioId ?? null) : null),
    excerptTMs: excerpt?.tMs ?? (preserveStoredMedia ? (existing?.excerptTMs ?? null) : null),
    vodPlaybackUrl:
      media.playbackUrl ?? (preserveStoredMedia ? (existing?.vodPlaybackUrl ?? null) : null),
    vodDownloadUrl:
      media.downloadUrl ?? (preserveStoredMedia ? (existing?.vodDownloadUrl ?? null) : null),
    facets,
    segments: media.segments,
  }

  try {
    const counts = await upsertSpeechBundle(payload, bundle)
    report.created = counts.created
    report.manualFacetsPreserved = counts.manualFacetsPreserved
    report.segmentCount = media.segments ? media.segments.length : (existing?.segmentCount ?? 0)
    run.totals.created += counts.created ? 1 : 0
    run.totals.updated += counts.created ? 0 : 1
  } catch (error) {
    report.failures.push({ stage: 'upsert', message: error?.message ?? String(error) })
  }

  run.totals.withExcerpt += excerpt ? 1 : 0
  run.totals.withoutExcerpt += excerpt ? 0 : 1
  run.totals.withSegments += report.segmentCount > 0 ? 1 : 0
  run.totals.failed += report.failures.length > 0 ? 1 : 0
  return report
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const printReport = (run) => {
  const { totals, asr, llm, failures } = run
  console.log('\n=== Relatório do import C153 ===')
  console.log(
    `discursos: ${totals.listed} listados, ${totals.processed} processados ` +
      `(${totals.created} criados, ${totals.updated} atualizados)`,
  )
  console.log(
    `vídeo: ${totals.withExcerpt} com trecho, ${totals.withoutExcerpt} sem trecho; ` +
      `${totals.withSegments} com segmentos`,
  )
  console.log(
    `ASR: ${asr.calls} chamadas, ${(asr.audioSeconds / 60).toFixed(1)} min de áudio, ` +
      `~US$ ${((asr.audioSeconds * DEEPINFRA_COST_PER_MINUTE_USD) / 60).toFixed(4)}, ` +
      `${(asr.elapsedMs / 1000).toFixed(0)}s de processamento, ${asr.failures} falhas`,
  )
  console.log(
    `LLM: ${llm.used}/${llm.calls} usadas, ${llm.totalTokens} tokens, ` +
      `~US$ ${llm.estimatedCostUsd.toFixed(4)}${llm.failed > 0 ? `, ${llm.failed} falhas` : ''}`,
  )
  console.log(`tempo total: ${(run.elapsedMs / 1000).toFixed(1)}s; falhas: ${failures.length}`)
  for (const failure of failures) {
    console.log(`  ✗ ${failure.speechAt} [${failure.stage}] ${failure.message}`)
  }
}

const speechLine = (report) => {
  const parts = [
    report.created ? 'criado' : 'atualizado',
    report.excerpt ? `trecho a=${report.excerpt.audioId} t=${report.excerpt.tMs}` : 'sem trecho',
  ]
  if (report.vodState) parts.push(`VOD ${report.vodState}`)
  if (report.segmentCount > 0) parts.push(`${report.segmentCount} segmentos`)
  if (report.presidingOfficer) parts.push(`presidiu ${report.presidingOfficer}`)
  if (report.classifiedBy) parts.push(`facetas ${report.classifiedBy}`)
  if (report.failures.length > 0) parts.push(`${report.failures.length} falha(s)`)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  assertLocalDatabase('camara:import', 'O import C153 escreve no banco local; produção é C155.')
  const payload = await getPayload({ config })

  const from = options.date ?? LEGISLATURE_RANGES[options.legislature][0]
  const to = options.date ?? LEGISLATURE_RANGES[options.legislature][1]
  const startedAt = Date.now()
  console.log(
    `[camara:import] deputado ${SOLLA_DEPUTY_ID} | ${from}..${to} | speaker "${options.speaker}"`,
  )

  const speeches = await fetchSpeeches(SOLLA_DEPUTY_ID, from, to)
  const targets = options.limit === null ? speeches : speeches.slice(0, options.limit)
  console.log(`[camara:import] ${speeches.length} discursos na API; processando ${targets.length}`)
  if (targets.length === 0) die(`nenhum discurso em ${from}..${to}.`)

  const run = {
    runAt: new Date().toISOString(),
    range: { from, to },
    options: {
      legislature: options.date ? null : options.legislature,
      date: options.date,
      limit: options.limit,
      speaker: options.speaker,
      skipTranscribe: options.skipTranscribe,
      reclassify: options.reclassify,
    },
    totals: {
      listed: speeches.length,
      processed: 0,
      created: 0,
      updated: 0,
      withExcerpt: 0,
      withoutExcerpt: 0,
      withSegments: 0,
      failed: 0,
    },
    asr: { calls: 0, audioSeconds: 0, elapsedMs: 0, failures: 0 },
    llm: { calls: 0, used: 0, failed: 0, totalTokens: 0, estimatedCostUsd: 0, sampleError: null },
    elapsedMs: 0,
    speeches: [],
    failures: [],
  }

  for (const [index, speech] of targets.entries()) {
    const report = await processSpeech(payload, speech, options, run)
    run.totals.processed += 1
    run.speeches.push(report)
    for (const failure of report.failures) {
      run.failures.push({ sourceKey: report.sourceKey, speechAt: report.speechAt, ...failure })
    }
    console.log(`[${index + 1}/${targets.length}] ${report.speechAt} — ${speechLine(report)}`)
  }

  run.elapsedMs = Date.now() - startedAt
  printReport(run)

  const reportPath = join(options.out, 'reports', `import-${run.runAt.replace(/[:.]/g, '-')}.json`)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(run, null, 2))
  console.log(`\n[camara:import] relatório JSON: ${reportPath}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  die(error?.message || String(error))
})
