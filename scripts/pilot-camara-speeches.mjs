/**
 * C152 pilot: processes 2–3 Câmara speeches end-to-end to de-risk the "acervo
 * de falas" source before C153 models it. No DB, no Payload, no collection —
 * this is a disposable-data spike whose durable outputs are the pure module
 * (`scripts/lib/camaraSpeeches.mjs`), its unit tests and the viability report
 * (`docs/research/piloto-fonte-videos-camara.md`).
 *
 * Flow per speech: open-data discursos → event on that date → speaker excerpt
 * on the event page (server-rendered `a`/`t` anchors) → `video-sob-demanda`
 * poll (async VOD transcoding) → MP4 download → Deep Infra Whisper large-v3
 * (OpenAI-compat `verbose_json`, segments with start/end) → report.
 *
 * Media/JSON artifacts land under `data/camara/` (gitignored), never in git.
 *
 * Usage:
 *   pnpm camara:pilot --legislature 57 --limit 1
 *   pnpm camara:pilot --date 2016-03-10
 *   pnpm camara:pilot --legislature 56 --skip-transcribe
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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
  matchExcerpt,
  parseEventExcerpts,
  selectSpeechEvents,
} from './lib/camaraSpeeches.mjs'
import { dieWithLabel, ensureCachedDownload, loadCliEnv } from './lib/cli.mjs'

loadCliEnv()

const die = dieWithLabel('camara:pilot')

const DEFAULT_OUT_DIR = 'data/camara'

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
  const options = {
    legislature: null,
    date: null,
    limit: 1,
    speaker: 'Jorge Solla',
    out: DEFAULT_OUT_DIR,
    skipTranscribe: false,
    skipDownload: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const value = () => {
      const next = argv[++i]
      if (next === undefined || next.startsWith('--')) die(`faltou valor para ${arg}.`)
      return next
    }
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--skip-transcribe') options.skipTranscribe = true
    else if (arg === '--skip-download') options.skipDownload = true
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
  if (!Number.isInteger(options.limit) || options.limit < 1) die('--limit deve ser >= 1.')
  if (!options.help && options.out.includes('..')) {
    die('--out não pode escapar do diretório do repo (sem "..").')
  }
  return options
}

const HELP = `
Uso: pnpm camara:pilot [--legislature 54|55|56|57] [--date YYYY-MM-DD] [opções]

Opções:
  --legislature <n>   54|55|56|57 (range de datas; ignorado se --date)
  --date <YYYY-MM-DD> discursos de um único dia (sobrepõe --legislature)
  --limit <n>         quantos discursos processar (default 1)
  --speaker <nome>    nome do orador a casar no evento (default "Jorge Solla")
  --out <dir>         diretório de cache/artefatos (default data/camara)
  --skip-download     não baixa o MP4 (resolve e registra o VOD)
  --skip-transcribe   não chama a Deep Infra
  --help              esta ajuda
`

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

const fileExists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const resolveRange = (options) => {
  if (options.date) return { from: options.date, to: options.date }
  const [from, to] = LEGISLATURE_RANGES[options.legislature]
  return { from, to }
}

// ---------------------------------------------------------------------------
// Per-speech orchestration
// ---------------------------------------------------------------------------

async function processSpeech(speech, options) {
  const report = {
    speechAt: speech.dataHoraInicio,
    type: speech.tipoDiscurso,
    phase: speech.faseEvento?.titulo ?? null,
    summary: speech.sumario ?? null,
    officialTranscriptChars: (speech.transcricao ?? '').length,
    oficialKeywords: (speech.keywords ?? '').split(/[\r\n]+/).filter(Boolean).length,
    event: null,
    eventUrl: null,
    youtube: null,
    excerpt: null,
    vodState: null,
    vodUrl: null,
    vodAttempts: null,
    downloadUrl: null,
    mp4: null,
    transcription: null,
    failures: [],
  }

  try {
    const date = speech.dataHoraInicio.slice(0, 10)
    const events = (await getJson(eventsUrl(date))).dados ?? []
    const candidates = selectSpeechEvents(events, speech.dataHoraInicio)
    if (candidates.length === 0) {
      report.failures.push(`nenhum evento em ${date}`)
      return report
    }

    for (const event of candidates) {
      const html = await getText(eventPageUrl(event.id), { timeoutMs: 60_000 })
      const excerpt = matchExcerpt(
        parseEventExcerpts(html, event.id),
        speech.dataHoraInicio,
        options.speaker,
      )
      if (!excerpt) continue
      report.event = {
        id: event.id,
        type: event.descricaoTipo,
        start: event.dataHoraInicio,
        status: event.situacao,
      }
      report.eventUrl = eventPageUrl(event.id)
      report.youtube = event.urlRegistro || null
      report.excerpt = excerpt
      break
    }

    if (!report.excerpt) {
      report.failures.push(`trecho de "${options.speaker}" não encontrado no(s) evento(s) do dia`)
      return report
    }

    const cacheKey = `${report.event.id}-${report.excerpt.audioId}-${report.excerpt.tMs}`
    const cachePath = join(options.out, `${cacheKey}.mp4`)

    if (await fileExists(cachePath)) {
      report.mp4 = { path: cachePath, bytes: (await readFile(cachePath)).length, cached: true }
    } else {
      const vod = await resolveVod(report.event.id, report.excerpt)
      report.vodState = vod.status.state
      report.vodUrl = vod.url
      report.vodAttempts = vod.attempts
      report.downloadUrl = vod.status.video?.downloadUrl ?? null
      if (report.vodState !== 'PRONTO' || !report.downloadUrl) {
        report.failures.push(`VOD não ficou PRONTO (estado=${report.vodState})`)
        return report
      }
      if (!options.skipDownload) {
        const cached = await ensureCachedDownload({
          label: 'camara:pilot',
          key: cacheKey,
          url: report.downloadUrl,
          ext: 'mp4',
          cacheDir: options.out,
          download: downloadToBuffer,
        })
        report.mp4 = {
          path: join(options.out, `${cacheKey}.mp4`),
          bytes: cached.buffer.length,
          sha256: cached.hash,
          cached: false,
        }
      }
    }

    if (!options.skipTranscribe && report.mp4) {
      const buffer = await readFile(report.mp4.path)
      const { transcription, elapsedMs } = await transcribeSpeechAudio(buffer)
      const estimatedCostUsd = transcription.duration
        ? (transcription.duration / 60) * DEEPINFRA_COST_PER_MINUTE_USD
        : null
      report.transcription = {
        language: transcription.language,
        durationSeconds: transcription.duration,
        segmentCount: transcription.segments.length,
        firstSegment: transcription.segments[0] ?? null,
        lastSegment: transcription.segments.at(-1) ?? null,
        textPreview: transcription.text.slice(0, 300),
        elapsedMs,
        estimatedCostUsd,
      }
    }
  } catch (error) {
    report.failures.push(error?.message || String(error))
  }

  return report
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`

function printReport(reports) {
  console.log('\n=== Relatório do piloto C152 ===')
  for (const report of reports) {
    console.log(`\n• discurso ${report.speechAt} — ${report.type ?? '?'} (${report.phase ?? '?'})`)
    console.log(`  resumo: ${(report.summary ?? '').slice(0, 90)}`)
    console.log(
      `  transcrição oficial: ${report.officialTranscriptChars} chars | keywords: ${report.oficialKeywords}`,
    )
    if (report.event) {
      console.log(
        `  evento: ${report.event.id} ${report.event.type} @ ${report.event.start} (${report.event.status})`,
      )
      console.log(`  página: ${report.eventUrl}`)
      console.log(`  youtube: ${report.youtube ?? '—'}`)
    }
    if (report.excerpt) {
      console.log(
        `  trecho: a=${report.excerpt.audioId} t=${report.excerpt.tMs} ` +
          `${report.excerpt.speaker} ${report.excerpt.party ?? ''} ` +
          `${report.excerpt.startTime ?? '?'} ${report.excerpt.duration ?? '?'}`,
      )
    }
    if (report.vodState) console.log(`  VOD: ${report.vodState} após ${report.vodAttempts} poll(s)`)
    if (report.downloadUrl) console.log(`  download: ${report.downloadUrl}`)
    if (report.mp4)
      console.log(`  MP4: ${report.mp4.path} (${(report.mp4.bytes / 1e6).toFixed(1)} MB)`)
    if (report.transcription) {
      const t = report.transcription
      console.log(
        `  ASR: ${t.segmentCount} segmentos | ${t.durationSeconds?.toFixed(1) ?? '?'}s | ` +
          `${seconds(t.elapsedMs)} | ~US$ ${t.estimatedCostUsd?.toFixed(5) ?? '?'}`,
      )
      if (t.firstSegment)
        console.log(
          `  primeiro: [${t.firstSegment.start}s–${t.firstSegment.end}s] ${t.firstSegment.text}`,
        )
      if (t.lastSegment)
        console.log(
          `  último:   [${t.lastSegment.start}s–${t.lastSegment.end}s] ${t.lastSegment.text}`,
        )
    }
    if (report.failures.length > 0) console.log(`  FALHAS: ${report.failures.join(' | ')}`)
  }
  const ok = reports.filter((r) => r.transcription?.segmentCount > 0).length
  console.log(`\nResultado: ${ok}/${reports.length} discurso(s) com transcrição segmentada.`)
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
  if (!options.skipTranscribe && !process.env.DEEPINFRA_API_KEY) {
    die('DEEPINFRA_API_KEY ausente — configure no .env.local ou no env do processo.')
  }

  const { from, to } = resolveRange(options)
  console.log(
    `[camara:pilot] deputado ${SOLLA_DEPUTY_ID} | ${from}..${to} | speaker "${options.speaker}"`,
  )

  const speeches = (await getJson(speechesUrl(SOLLA_DEPUTY_ID, from, to))).dados ?? []
  const targets = speeches
    .filter((s) => (s.transcricao ?? '').trim() !== '')
    .slice(0, options.limit)
  if (targets.length === 0) die(`nenhum discurso com transcrição em ${from}..${to}.`)

  const reports = []
  for (const speech of targets) {
    reports.push(await processSpeech(speech, options))
  }

  printReport(reports)
  const reportPath = join(options.out, 'pilot-report.json')
  await mkdir(options.out, { recursive: true })
  await writeFile(reportPath, JSON.stringify(reports, null, 2))
  console.log(`\n[camara:pilot] relatório JSON: ${reportPath}`)
}

main().catch((error) => die(error?.message || String(error)))
