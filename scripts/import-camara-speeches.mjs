/**
 * C153 import + C155 backfill — populates the speech catalog from the Câmara
 * sources: open-data speeches → event on that date → speaker excerpt on the
 * event page → async VOD → Deep Infra Whisper segments (minutagem) + facet
 * classification (gazetteer + LLM) → idempotent upsert into
 * `speech`/`speechSegment`.
 *
 * Re-running is safe: records are matched by `sourceKey`, metadata is
 * refreshed, VOD/ASR is skipped when the excerpt identity and segments are
 * already stored, and a `manual` facet curation is never overwritten.
 *
 * C155 adds the full-archive backfill (`--all`, one process, per-legislature
 * report + DB coverage) and the read-only modes `--coverage` and
 * `--verify-links <n>`. Media and reports land under `data/camara/`
 * (gitignored). The local-DB guard refuses a non-local DATABASE_URL, and any
 * write run targeting production (or a remote/override DB) additionally
 * requires `CAMARA_IMPORT_CONFIRM=1`.
 *
 * Usage:
 *   pnpm camara:import --legislature 57
 *   pnpm camara:import --date 2023-02-07 --limit 3
 *   pnpm camara:import --all
 *   pnpm camara:import --all --limit 2          # smoke
 *   pnpm camara:import --coverage
 *   pnpm camara:import --verify-links 3
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
  getJsonWithBackoff,
  getText,
  probeVodLink,
  resolveVod,
  speechesUrl,
  transcribeSpeechAudio,
} from './lib/camaraFetch.mjs'
import {
  LEGISLATURE_RANGES,
  SOLLA_DEPUTY_ID,
  aggregateBackfillRuns,
  dateRangeChunks,
  legislatureForDate,
  matchExcerpt,
  parseDurationToSeconds,
  parseEventExcerpts,
  parseOfficialKeywords,
  parsePresidingOfficerTransitions,
  resolvePresidingOfficer,
  selectLinkSample,
  selectSpeechEvents,
  speechContentHash,
  speechDate,
  speechSourceKey,
} from './lib/camaraSpeeches.mjs'
import {
  databaseHostname,
  dieWithLabel,
  ensureCachedDownload,
  isTruthyEnv,
  loadCliEnv,
  requiresWriteConfirm,
} from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('camara:import')

const config = (await import('../src/payload.config.ts')).default
const { findSpeechImportState, upsertSpeechBundle } =
  await import('../src/utilities/speech/speechImport.ts')
const { classifySpeech } = await import('../src/utilities/speech/speechClassifier.ts')
const { getSpeechCoverage } = await import('../src/utilities/speech/speechCoverage.ts')

const WRITE_CONFIRM_FLAG = 'CAMARA_IMPORT_CONFIRM'

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
    legislature: null,
    all: false,
    date: null,
    limit: null,
    speaker: 'Jorge Solla',
    out: DEFAULT_OUT_DIR,
    skipTranscribe: false,
    reclassify: false,
    coverage: false,
    verifyLinks: null,
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
    else if (arg === '--all') options.all = true
    else if (arg === '--coverage') options.coverage = true
    else if (arg === '--verify-links') options.verifyLinks = Number(value())
    else if (arg === '--skip-transcribe') options.skipTranscribe = true
    else if (arg === '--reclassify') options.reclassify = true
    else if (arg === '--legislature') options.legislature = Number(value())
    else if (arg === '--date') options.date = value()
    else if (arg === '--limit') options.limit = Number(value())
    else if (arg === '--speaker') options.speaker = value()
    else if (arg === '--out') options.out = value()
    else die(`argumento desconhecido: ${arg}`)
  }
  if (options.help) return options

  const readOnlyModes = [options.coverage, options.verifyLinks !== null].filter(Boolean).length
  const importModes = [options.all, options.date !== null, options.legislature !== null].filter(
    Boolean,
  ).length
  if (readOnlyModes > 1) die('--coverage e --verify-links são modos separados.')
  if (readOnlyModes > 0 && importModes > 0) {
    die('--coverage/--verify-links não combinam com --all/--date/--legislature.')
  }
  if (
    readOnlyModes > 0 &&
    (options.limit !== null || options.skipTranscribe || options.reclassify)
  ) {
    die('--limit/--skip-transcribe/--reclassify só valem para os modos de import.')
  }
  if (options.all && options.date !== null) die('--all e --date são mutuamente exclusivos.')
  if (options.all && options.legislature !== null) {
    die('--all e --legislature são mutuamente exclusivos.')
  }
  if (
    options.verifyLinks !== null &&
    (!Number.isInteger(options.verifyLinks) || options.verifyLinks < 1)
  ) {
    die('--verify-links exige um inteiro >= 1.')
  }
  if (importModes === 0 && readOnlyModes === 0) options.legislature = 57
  if (options.legislature !== null && !LEGISLATURE_RANGES[options.legislature]) {
    die('informe --legislature <54|55|56|57> ou --date <YYYY-MM-DD> (veja --help).')
  }
  if (options.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    die('--date deve ser YYYY-MM-DD.')
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    die('--limit deve ser >= 1.')
  }
  if (options.out.includes('..')) {
    die('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

const HELP = `
Uso: pnpm camara:import [--all | --legislature 54|55|56|57 | --date YYYY-MM-DD | --coverage | --verify-links <n>] [opções]

Modos de import (escrevem no acervo):
  --all                processa as 54ª–57ª em sequência (relatório por legislatura)
  --legislature <n>    54|55|56|57 (default 57 quando nenhum modo é dado; ignorado se --date)
  --date <YYYY-MM-DD>  discursos de um único dia
Modos read-only:
  --coverage           imprime a cobertura do banco por legislatura (sem rede/escrita)
  --verify-links <n>   amostra n discursos por legislatura e testa os links do VOD

Opções de import:
  --limit <n>         quantos discursos processar por legislatura (default: todos)
  --speaker <nome>    nome do orador a casar no evento (default "Jorge Solla")
  --out <dir>         diretório de cache/artefatos (default data/camara)
  --skip-transcribe   não chama a Deep Infra (preserva os segmentos existentes)
  --reclassify        refaz a classificação mesmo já tendo facetas da LLM
  --help              esta ajuda

Escrita em alvo não-local ou com NODE_ENV=production exige CAMARA_IMPORT_CONFIRM=1
(runbook: docs/ops/teqo-1313-deploy.md §C155).
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

async function fetchSpeechesRange(deputyId, from, to) {
  const speeches = []
  for (let page = 1; ; page += 1) {
    const body = await getJsonWithBackoff(`${speechesUrl(deputyId, from, to)}&pagina=${page}`, {
      label: 'camara:import',
    })
    const batch = body.dados ?? []
    speeches.push(...batch)
    const hasNext = (body.links ?? []).some((link) => link?.rel === 'next')
    if (!hasNext || batch.length === 0) break
    await sleep(500)
  }
  return speeches
}

/**
 * Lista a faixa inteira; se a API recusar uma página funda (500/hang
 * persistente, visto na 55ª em 2026-09-13), cai para a listagem por ano e,
 * se um ano inteiro falhar, desce ao mês — cada chunk é raso e um mês
 * quebrado não derruba os demais. Os chunks que falharem são reportados via
 * `onWarning` (o run os registra como falha de `list`).
 */
async function fetchSpeeches(deputyId, from, to, onWarning = () => {}) {
  try {
    return await fetchSpeechesRange(deputyId, from, to)
  } catch (error) {
    onWarning(`listagem ${from}..${to} falhou (${error?.message}); tentando por ano`)
    const speeches = []
    let listedChunks = 0
    for (const [yearFrom, yearTo] of dateRangeChunks(from, to)) {
      try {
        speeches.push(...(await fetchSpeechesRange(deputyId, yearFrom, yearTo)))
        listedChunks += 1
        continue
      } catch (yearError) {
        onWarning(`listagem ${yearFrom}..${yearTo} falhou: ${yearError?.message}; tentando por mês`)
      }
      for (const [monthFrom, monthTo] of dateRangeChunks(yearFrom, yearTo, 'month')) {
        try {
          speeches.push(...(await fetchSpeechesRange(deputyId, monthFrom, monthTo)))
          listedChunks += 1
        } catch (monthError) {
          onWarning(`listagem ${monthFrom}..${monthTo} falhou: ${monthError?.message}`)
        }
      }
    }
    if (listedChunks === 0) throw error
    return speeches
  }
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
  // Identity: the API triple is the key; a genuinely distinct speech sharing
  // the triple (seen 2026-06-17T17:16) gets a content-hash suffix instead of
  // overwriting the first one.
  const baseKey = speechSourceKey(speech)
  const contentHash = speechContentHash(speech.sumario, speech.transcricao)
  const baseState = await findSpeechImportState(payload, baseKey)
  const suffixedKey =
    Boolean(baseState) &&
    contentHash !== speechContentHash(baseState.summary, baseState.officialTranscript)
  const sourceKey = suffixedKey ? `${baseKey}#${contentHash}` : baseKey
  const existing = suffixedKey ? await findSpeechImportState(payload, sourceKey) : baseState

  const report = {
    sourceKey,
    suffixedKey,
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
  console.log('\n=== Relatório do import (camara:import) ===')
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

const pad = (value, width) => String(value).padStart(width)
const padEnd = (value, width) => String(value).padEnd(width)

const printCoverage = (coverage) => {
  console.log('\n=== Cobertura do acervo (por legislatura) ===')
  console.log(
    `${padEnd('leg', 5)}${pad('total', 7)}${pad('trecho', 8)}${pad('vídeo', 7)}` +
      `${pad('segm.', 7)}${pad('sem trecho', 11)}${pad('sem segm.', 10)}${pad('fallback YT', 12)}`,
  )
  for (const row of coverage.byLegislature) {
    console.log(
      `${padEnd(row.legislature ?? '—', 5)}${pad(row.total, 7)}${pad(row.withExcerpt, 8)}` +
        `${pad(row.withVideo, 7)}${pad(row.withSegments, 7)}${pad(row.withoutExcerpt, 11)}` +
        `${pad(row.withoutSegments, 10)}${pad(row.fallbackYoutube, 12)}`,
    )
  }
  const { totals } = coverage
  console.log(
    `${padEnd('total', 5)}${pad(totals.total, 7)}${pad(totals.withExcerpt, 8)}` +
      `${pad(totals.withVideo, 7)}${pad(totals.withSegments, 7)}${pad(totals.withoutExcerpt, 11)}` +
      `${pad(totals.withoutSegments, 10)}${pad(totals.fallbackYoutube, 12)}`,
  )
}

const printBackfillReport = (combined) => {
  console.log('\n=== Relatório do backfill (54ª–57ª) ===')
  for (const run of combined.legislatures) {
    const { totals, asr } = run
    console.log(
      `${run.legislature}ª: ${totals.listed} listados, ${totals.processed} processados ` +
        `(${totals.created} criados, ${totals.updated} atualizados) · ` +
        `${totals.withExcerpt} com trecho / ${totals.withoutExcerpt} sem · ` +
        `${totals.withSegments} com segmentos · ` +
        `ASR ${(asr.audioSeconds / 60).toFixed(1)} min ` +
        `~US$ ${((asr.audioSeconds * DEEPINFRA_COST_PER_MINUTE_USD) / 60).toFixed(4)} · ` +
        `${(run.elapsedMs / 1000).toFixed(0)}s` +
        `${run.failures.length > 0 ? ` · ${run.failures.length} falha(s)` : ''}` +
        `${run.aborted ? ' · ABORTADA' : ''}`,
    )
  }
  const { totals, asr, llm } = combined
  console.log(
    `combinado: ${totals.processed} processados (${totals.created} criados, ` +
      `${totals.updated} atualizados) · ${totals.withSegments} com segmentos · ` +
      `ASR ${(asr.audioSeconds / 60).toFixed(1)} min ~US$ ` +
      `${((asr.audioSeconds * DEEPINFRA_COST_PER_MINUTE_USD) / 60).toFixed(4)} · ` +
      `LLM ${llm.used}/${llm.calls} ~US$ ${llm.estimatedCostUsd.toFixed(4)}`,
  )
  console.log(
    `tempo total: ${(combined.elapsedMs / 1000).toFixed(1)}s; falhas: ${combined.failures.length}`,
  )
  for (const failure of combined.failures) {
    console.log(
      `  ✗ [${failure.legislature ?? '-'}] ${failure.speechAt} [${failure.stage}] ${failure.message}`,
    )
  }
}

const speechLine = (report) => {
  const parts = [
    report.created ? 'criado' : 'atualizado',
    report.excerpt ? `trecho a=${report.excerpt.audioId} t=${report.excerpt.tMs}` : 'sem trecho',
  ]
  if (report.suffixedKey) parts.push('chave sufixada por colisão')
  if (report.vodState) parts.push(`VOD ${report.vodState}`)
  if (report.segmentCount > 0) parts.push(`${report.segmentCount} segmentos`)
  if (report.presidingOfficer) parts.push(`presidiu ${report.presidingOfficer}`)
  if (report.classifiedBy) parts.push(`facetas ${report.classifiedBy}`)
  if (report.failures.length > 0) parts.push(`${report.failures.length} falha(s)`)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const stamp = (runAt) => runAt.replace(/[:.]/g, '-')

const writeReport = async (options, filename, report) => {
  const reportPath = join(options.out, 'reports', filename)
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  return reportPath
}

const runOptions = (options) => ({
  // A `--date` run is not a legislature run — C153 shape kept.
  legislature: options.all || options.date ? null : options.legislature,
  all: options.all,
  date: options.date,
  limit: options.limit,
  speaker: options.speaker,
  skipTranscribe: options.skipTranscribe,
  reclassify: options.reclassify,
})

const createRun = (options, { legislature, from, to }) => ({
  runAt: new Date().toISOString(),
  mode: options.date ? 'date' : 'legislature',
  legislature,
  range: { from, to },
  options: runOptions(options),
  totals: {
    listed: 0,
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
})

const processTargets = async (payload, options, targets, run) => {
  for (const [index, speech] of targets.entries()) {
    const report = await processSpeech(payload, speech, options, run)
    run.totals.processed += 1
    run.speeches.push(report)
    for (const failure of report.failures) {
      run.failures.push({ sourceKey: report.sourceKey, speechAt: report.speechAt, ...failure })
    }
    console.log(`[${index + 1}/${targets.length}] ${report.speechAt} — ${speechLine(report)}`)
  }
}

/**
 * One legislature end-to-end: list from the API, slice `--limit`, process,
 * close the run. Throws on a list failure or an empty range — the caller owns
 * the policy (single range dies; `--all` marks the legislature aborted and
 * continues with the next).
 */
const runLegislature = async (payload, options, { legislature, from, to, label }) => {
  const run = createRun(options, { legislature, from, to })
  const startedAt = Date.now()
  console.log(`\n[camara:import] === ${label} (${from}..${to}) ===`)

  const speeches = await fetchSpeeches(SOLLA_DEPUTY_ID, from, to, (message) => {
    run.failures.push({ sourceKey: null, speechAt: null, stage: 'list', message })
  })
  const targets = options.limit === null ? speeches : speeches.slice(0, options.limit)
  console.log(`[camara:import] ${speeches.length} discursos na API; processando ${targets.length}`)
  if (targets.length === 0) throw new Error(`nenhum discurso em ${from}..${to}.`)
  run.totals.listed = speeches.length

  await processTargets(payload, options, targets, run)
  run.elapsedMs = Date.now() - startedAt
  return run
}

const runSingleRange = async (payload, options) => {
  const from = options.date ?? LEGISLATURE_RANGES[options.legislature][0]
  const to = options.date ?? LEGISLATURE_RANGES[options.legislature][1]
  console.log(
    `[camara:import] deputado ${SOLLA_DEPUTY_ID} | ${from}..${to} | speaker "${options.speaker}"`,
  )
  const run = await runLegislature(payload, options, {
    legislature: options.date ? null : options.legislature,
    from,
    to,
    label: options.date ? `date ${options.date}` : `legislatura ${options.legislature}ª`,
  })
  run.coverage = await getSpeechCoverage(payload)
  printReport(run)
  printCoverage(run.coverage)

  const reportPath = await writeReport(options, `import-${stamp(run.runAt)}.json`, run)
  console.log(`\n[camara:import] relatório JSON: ${reportPath}`)
}

const runBackfill = async (payload, options) => {
  const startedAt = Date.now()
  const combined = {
    runAt: new Date().toISOString(),
    mode: 'all',
    options: runOptions(options),
    legislatures: [],
    ...aggregateBackfillRuns([]),
    failures: [],
    coverage: null,
  }
  const legislatures = Object.keys(LEGISLATURE_RANGES)
    .map(Number)
    .sort((left, right) => left - right)

  for (const legislature of legislatures) {
    const [from, to] = LEGISLATURE_RANGES[legislature]
    const rangeStartedAt = Date.now()
    let run
    try {
      run = await runLegislature(payload, options, {
        legislature,
        from,
        to,
        label: `legislatura ${legislature}ª`,
      })
    } catch (error) {
      run = createRun(options, { legislature, from, to })
      run.aborted = true
      run.elapsedMs = Date.now() - rangeStartedAt
      run.failures.push({
        sourceKey: null,
        speechAt: null,
        stage: 'legislature',
        message: error?.message ?? String(error),
      })
      console.error(
        `[camara:import] legislatura ${legislature}ª abortada: ${error?.message ?? error}`,
      )
    }
    combined.legislatures.push(run)
    combined.failures.push(...run.failures.map((failure) => ({ legislature, ...failure })))

    const partial = aggregateBackfillRuns(combined.legislatures)
    combined.totals = partial.totals
    combined.asr = partial.asr
    combined.llm = partial.llm
    combined.elapsedMs = Date.now() - startedAt
    // Checkpoint after each legislature: a network drop loses at most one.
    await writeReport(options, `backfill-${stamp(combined.runAt)}.json`, combined)
  }

  combined.coverage = await getSpeechCoverage(payload)
  printBackfillReport(combined)
  printCoverage(combined.coverage)

  const reportPath = await writeReport(options, `backfill-${stamp(combined.runAt)}.json`, combined)
  console.log(`\n[camara:import] relatório JSON: ${reportPath}`)
  if (combined.legislatures.some((run) => run.aborted)) {
    die('legislatura(s) abortada(s) — reexecute --all ou --legislature <n> para completar.')
  }
}

const runCoverage = async (payload, options) => {
  const startedAt = Date.now()
  const coverage = await getSpeechCoverage(payload)
  printCoverage(coverage)
  const report = {
    runAt: new Date().toISOString(),
    mode: 'coverage',
    options: runOptions(options),
    coverage,
    elapsedMs: Date.now() - startedAt,
  }
  const reportPath = await writeReport(options, `coverage-${stamp(report.runAt)}.json`, report)
  console.log(`\n[camara:import] relatório JSON: ${reportPath}`)
}

const runVerifyLinks = async (payload, options) => {
  const startedAt = Date.now()
  const found = await payload.find({
    collection: 'speech',
    where: { or: [{ vodPlaybackUrl: { exists: true } }, { vodDownloadUrl: { exists: true } }] },
    pagination: false,
    depth: 0,
    select: { legislature: true, speechAt: true, vodPlaybackUrl: true, vodDownloadUrl: true },
    // Intentional bypass: the import CLI is a trusted actor with no session.
    overrideAccess: true,
  })
  const sample = selectLinkSample(found.docs, options.verifyLinks)
  console.log(
    `[camara:import] amostra: ${sample.length} discursos (${options.verifyLinks} por legislatura)`,
  )

  const checked = []
  for (const row of sample) {
    const links = [
      ['playback', row.vodPlaybackUrl],
      ['download', row.vodDownloadUrl],
    ]
    for (const [kind, url] of links) {
      if (!url) continue
      const probe = await probeVodLink(url)
      checked.push({ legislature: row.legislature, speechId: row.id, kind, ...probe })
      console.log(
        `[camara:import] ${row.legislature ?? '—'} #${row.id} ${kind}: ` +
          `${probe.ok ? 'ok' : 'WARN'} ${probe.note}`,
      )
      await sleep(250)
    }
  }

  const warnings = checked.filter((entry) => !entry.ok).length
  const report = {
    runAt: new Date().toISOString(),
    mode: 'verify-links',
    options: runOptions(options),
    sample: { perLegislature: options.verifyLinks, total: sample.length },
    checked,
    ok: checked.length - warnings,
    warnings,
    elapsedMs: Date.now() - startedAt,
  }
  if (checked.length === 0) {
    die('nenhum link de VOD verificado — amostra vazia (banco sem links?).')
  }
  console.log(
    `[camara:import] links: ${report.ok}/${checked.length} ok` +
      `${warnings > 0 ? `, ${warnings} warning(s)` : ''}`,
  )
  const reportPath = await writeReport(options, `verify-links-${stamp(report.runAt)}.json`, report)
  console.log(`\n[camara:import] relatório JSON: ${reportPath}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const databaseTarget = () => {
  const url = process.env.DATABASE_URL
  const host = databaseHostname(url)
  if (host === null) return '(DATABASE_URL ausente ou inválida)'
  // `databaseHostname` only returns non-null when `new URL` already parsed.
  return `${host}${new URL(url).pathname}`
}

const modeLabel = (options) => {
  if (options.coverage) return 'coverage (read-only)'
  if (options.verifyLinks !== null) return `verify-links n=${options.verifyLinks} (read-only)`
  if (options.all) return 'backfill 54ª–57ª'
  if (options.date) return `date ${options.date}`
  return `legislature ${options.legislature}`
}

/**
 * C155 write guard: the homeserver env file sets `NODE_ENV=production` and the
 * runbook rewrites the DB host to the local proxy, so the host check alone
 * cannot see production — the explicit flag is what makes the write deliberate.
 */
const assertWriteAllowed = () => {
  if (!requiresWriteConfirm()) return
  if (isTruthyEnv(process.env[WRITE_CONFIRM_FLAG])) return
  die(
    `alvo de escrita não-local/produção detectado (${databaseTarget()}).\n` +
      `Confirme a intenção com:\n  ${WRITE_CONFIRM_FLAG}=1 pnpm camara:import …\n` +
      `Runbook: docs/ops/teqo-1313-deploy.md §C155.`,
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    process.exit(0)
  }

  const readOnly = options.coverage || options.verifyLinks !== null
  if (readOnly) {
    if (!process.env.DATABASE_URL) die('DATABASE_URL não definida; recusando continuar.')
  } else {
    // Confirm first: a non-local host is exactly what the flag is for; the
    // local-DB guard below still blocks a remote host without ALLOW_REMOTE_DB.
    assertWriteAllowed()
    assertLocalDatabase(
      'camara:import',
      'O import escreve no acervo; produção exige CAMARA_IMPORT_CONFIRM=1 (runbook §C155).',
    )
  }
  console.log(`[camara:import] alvo: ${databaseTarget()} | modo: ${modeLabel(options)}`)

  const payload = await getPayload({ config })
  if (options.coverage) await runCoverage(payload, options)
  else if (options.verifyLinks !== null) await runVerifyLinks(payload, options)
  else if (options.all) await runBackfill(payload, options)
  else await runSingleRange(payload, options)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  die(error?.message || String(error))
})
