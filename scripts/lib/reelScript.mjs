/**
 * C197 — the script layer of the reel: the spoken text of each beat, the
 * `narracao.srt` + `roteiro.md` the assessoria re-records from, and the PCM
 * math that fits the TTS draft into the exact video duration.
 *
 * The transcription is generated for every package (with or without TTS), so
 * this module never touches ffmpeg, the browser or the network: it is pure and
 * unit-tested. The narration text is the approved shot list text — the skill
 * never paraphrases.
 */

/** PCM format the narration beat is decoded to: s16le, 24 kHz, mono. */
export const NARRATION_PCM = {
  sampleRate: 24000,
  channels: 1,
  bytesPerSample: 2,
}

/** `atempo` ceiling: a draft sped up further loses intelligibility. */
export const MAX_BEAT_TEMPO = 1.5

/**
 * Spoken text of one scene: the explicit `narration` when declared, the burned
 * caption of a capture scene as fallback, silence otherwise (graphic scenes
 * without narration).
 *
 * @param {{ kind: string, template?: string, narration?: string | null, caption?: { parts: Array<{ text: string }> } | null }} scene
 * @returns {string | null}
 */
export const resolveSceneNarration = (scene) => {
  if (typeof scene.narration === 'string' && scene.narration.trim() !== '') {
    return scene.narration.trim()
  }
  if (scene.kind === 'capture' && scene.caption) {
    const text = scene.caption.parts
      .map((part) => part.text)
      .join('')
      .trim()
    return text === '' ? null : text
  }
  return null
}

/**
 * One beat per scene, in `shotList.scenes` order (the concat order), with the
 * cumulative window of the final video. Scenes without speech stay in the list
 * with `text: null` — their window is filled with silence on the audio track.
 *
 * @param {{ shotList: { scenes: Array<Record<string, unknown>> }, plans: Map<string, { durationMs: number }> }} options
 * @returns {Array<{ id: string, kind: string, label: string, startMs: number, endMs: number, durationMs: number, text: string | null }>}
 */
export const buildScriptBeats = ({ shotList, plans }) => {
  let cursorMs = 0
  return shotList.scenes.map((scene) => {
    const plan = plans.get(scene.id)
    if (!plan) throw new Error(`Roteiro: cena "${scene.id}" sem plano de duração.`)
    const durationMs = Math.max(0, Math.round(plan.durationMs))
    const beat = {
      id: scene.id,
      kind: scene.kind,
      label: scene.kind === 'capture' ? scene.badge.label : scene.template,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
      durationMs,
      text: resolveSceneNarration(scene),
    }
    cursorMs += durationMs
    return beat
  })
}

const pad = (value, size) => String(value).padStart(size, '0')

/** SRT timecode: `HH:MM:SS,mmm` (rounded to the millisecond). */
export const formatSrtTime = (ms) => {
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1_000)
  const millis = total % 1_000
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`
}

/**
 * `narracao.srt` content: one block per beat that has speech, timecodes from
 * the scene window (simple by design — no word-level timing).
 *
 * @param {Array<{ startMs: number, endMs: number, text: string | null }>} beats
 * @returns {string}
 */
export const buildReelSrt = (beats) => {
  const blocks = []
  for (const beat of beats) {
    if (!beat.text) continue
    blocks.push(
      `${blocks.length + 1}\n${formatSrtTime(beat.startMs)} --> ${formatSrtTime(beat.endMs)}\n${beat.text}`,
    )
  }
  return blocks.length === 0 ? '' : `${blocks.join('\n\n')}\n`
}

/** Readable pt-BR seconds label (`19,4s`) shared by the roteiro and the TTS errors. */
export const secondsLabel = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')}s`

/**
 * `roteiro.md` content: read aloud by the assessoria, with beat/scene marks and
 * the window of each scene. Mute scenes are marked, never dropped.
 *
 * @param {{ shotList: { slug: string, title: string }, hash: string, beats: Array<{ id: string, label: string, startMs: number, endMs: number, text: string | null }>, durationMs: number }} options
 * @returns {string}
 */
export const buildReelRoteiro = ({ shotList, hash, beats, durationMs }) => {
  const lines = [
    `# Roteiro — ${shotList.title}`,
    '',
    `- Reel: \`${shotList.slug}\``,
    `- Shot list: \`${hash}\``,
    `- Duração: ${secondsLabel(durationMs)} (${beats.length} cenas)`,
    '',
    'Transcrição do roteiro aprovado no gate. A assessoria pode regravar com a própria voz.',
    '',
  ]
  beats.forEach((beat, index) => {
    lines.push(
      `## ${index + 1}. ${beat.id} — ${secondsLabel(beat.startMs)}–${secondsLabel(beat.endMs)} · ${beat.label}`,
    )
    lines.push('')
    lines.push(beat.text ?? '_Sem fala nesta cena._')
    lines.push('')
  })
  return `${lines.join('\n').trimEnd()}\n`
}

/** Sample count of a duration in the narration PCM format (exact, no ffprobe). */
export const pcmSampleCount = (durationMs, pcm = NARRATION_PCM) =>
  Math.max(0, Math.round((durationMs / 1000) * pcm.sampleRate))

/** Byte length of one PCM sample count. */
export const pcmByteLength = (samples, pcm = NARRATION_PCM) =>
  samples * pcm.channels * pcm.bytesPerSample

/** Exact duration (ms) of a decoded PCM buffer — the ffprobe substitute. */
export const pcmDurationMs = (byteLength, pcm = NARRATION_PCM) =>
  (byteLength / (pcm.sampleRate * pcm.channels * pcm.bytesPerSample)) * 1000

/**
 * Speed factor that fits a synthesized beat into its scene window. Never slows
 * down (a short line is padded with silence); beyond `maxTempo` the fit is
 * impossible and the caller fails closed.
 *
 * @param {{ durationMs: number, targetMs: number, maxTempo?: number }} options
 * @returns {{ tempo: number, overflow: boolean }}
 */
export const fitBeat = ({ durationMs, targetMs, maxTempo = MAX_BEAT_TEMPO }) => {
  if (!(targetMs > 0)) throw new Error(`Fit da fala: janela inválida (${targetMs}ms).`)
  const ratio = durationMs / targetMs
  if (ratio <= 1) return { tempo: 1, overflow: false }
  const tempo = Math.round(Math.min(ratio, maxTempo) * 10_000) / 10_000
  return { tempo, overflow: ratio > maxTempo + 1e-9 }
}

/** PCM buffer exactly `samples` long: zero-padded or trimmed to the boundary. */
export const padPcmToSamples = (pcm, samples) => {
  const targetBytes = pcmByteLength(samples)
  if (pcm.length === targetBytes) return pcm
  if (pcm.length > targetBytes) return pcm.subarray(0, targetBytes)
  const padded = Buffer.alloc(targetBytes)
  pcm.copy(padded)
  return padded
}
