import 'server-only'

import {
  normalizeRecordingTranscription,
  type RecordingChunkSegment,
} from '@/lib/recordingTranscription'

/**
 * Transcribes a recorded voice clip to text via Deep Infra's OpenAI-compatible
 * transcription endpoint (B173). Deep Infra serves Whisper large-v3 at
 * $0.00045/audio minute — the cheapest speech-to-text around — so it stays
 * here even though the Sollinha LLM talks to api.deepseek.com directly
 * (`DEEPSEEK_API_KEY`); this path uses its own `DEEPINFRA_API_KEY`.
 *
 * The audio is forwarded as a multipart `file` and never persisted anywhere —
 * it lives only in this function's memory for the duration of the provider
 * call (product requirement: B173 processes and discards the recording).
 *
 * C199 — `deepInfraTranscribeSegments` is the timestamped sibling used by the
 * recording transcription job: same provider and key, `verbose_json` with
 * segment timestamps (the shape the Câmara CLI already validates).
 */

export const DEEPINFRA_TRANSCRIBE_URL = 'https://api.deepinfra.com/v1/openai/audio/transcriptions'
const DEEPINFRA_WHISPER_MODEL = 'openai/whisper-large-v3'
const DEEPINFRA_LANGUAGE = 'pt'

export type TranscribeAudioResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number }

const TRANSCRIBE_ERROR = 'Não foi possível transcrever o áudio. Tente novamente.'

/**
 * Sends the clip to Deep Infra Whisper large-v3 and returns the transcript.
 * Never throws: every failure becomes `{ ok: false }` with a pt-BR message the
 * route can return verbatim, so a provider outage or a missing key degrades to
 * "sem voz" instead of breaking the text chat.
 */
export const deepInfraTranscribe = async (file: Blob): Promise<TranscribeAudioResult> => {
  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Transcrição de voz está indisponível no momento.', status: 503 }
  }

  const form = new FormData()
  form.append('file', file, 'voice.webm')
  form.append('model', DEEPINFRA_WHISPER_MODEL)
  form.append('language', DEEPINFRA_LANGUAGE)

  try {
    const response = await fetch(DEEPINFRA_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!response.ok) {
      return {
        ok: false,
        error: TRANSCRIBE_ERROR,
        status: 502,
      }
    }

    const data = (await response.json()) as { text?: unknown }
    const text = typeof data.text === 'string' ? data.text.trim() : ''
    if (!text) {
      return {
        ok: false,
        error: TRANSCRIBE_ERROR,
        status: 502,
      }
    }

    return { ok: true, text }
  } catch {
    return {
      ok: false,
      error: TRANSCRIBE_ERROR,
      status: 502,
    }
  }
}

export type TranscribeSegmentsResult =
  | { ok: true; segments: RecordingChunkSegment[]; durationSeconds: number | null }
  | { ok: false; error: string; status: number }

const SEGMENTS_TIMEOUT_MS = 600_000

/**
 * C199 — sends one audio chunk to Deep Infra Whisper with segment timestamps
 * and returns the normalized segments (relative to the chunk). Never throws:
 * the job maps `{ ok: false }` to the recording's `failed` state with the
 * pt-BR message. The caller owns the offset merge and the chunk size.
 */
export const deepInfraTranscribeSegments = async (
  file: Blob,
  {
    filename = 'chunk.mp3',
    timeoutMs = SEGMENTS_TIMEOUT_MS,
  }: { filename?: string; timeoutMs?: number } = {},
): Promise<TranscribeSegmentsResult> => {
  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Transcrição de áudio está indisponível no momento.', status: 503 }
  }

  const form = new FormData()
  form.append('file', file, filename)
  form.append('model', DEEPINFRA_WHISPER_MODEL)
  form.append('language', DEEPINFRA_LANGUAGE)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')

  try {
    const response = await fetch(DEEPINFRA_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      return { ok: false, error: TRANSCRIBE_ERROR, status: 502 }
    }

    const normalized = normalizeRecordingTranscription(await response.json())
    if (normalized.segments.length === 0) {
      return { ok: false, error: TRANSCRIBE_ERROR, status: 502 }
    }
    return { ok: true, ...normalized }
  } catch {
    return { ok: false, error: TRANSCRIBE_ERROR, status: 502 }
  }
}
