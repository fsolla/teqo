import 'server-only'

import { openAsBlob } from 'node:fs'

import type { DiarizedTurn } from '@/lib/recordingDiarization'

/**
 * C200 — the diarization provider: AssemblyAI's async pre-recorded API with
 * `speaker_labels` (acoustic clustering only). The recording is sent as ONE
 * file so the speaker numbering is global; the voice is never matched to a
 * person and the account-level speaker identification feature is deliberately
 * never enabled — naming is human (design scenes 1/2).
 *
 * Never throws: every failure becomes `{ ok: false }` and the transcription job
 * degrades to the honest single-block transcript (no speaker grouping) instead
 * of failing the recording. The remote transcript/audio is deleted best-effort
 * after the read.
 *
 * Provider notes (verified 2026-09-19): Universal-2 at US$0,15/h + async
 * diarization add-on US$0,02/h; up to 10 h / 5 GB per file; `speech_models` is
 * the plural request field (the singular is deprecated).
 */

export const ASSEMBLYAI_UPLOAD_URL = 'https://api.assemblyai.com/v2/upload'
export const ASSEMBLYAI_TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript'
const ASSEMBLYAI_MODEL = 'universal-2'
const ASSEMBLYAI_LANGUAGE = 'pt'

const UPLOAD_TIMEOUT_MS = 10 * 60_000
const POLL_REQUEST_TIMEOUT_MS = 30_000
const DIARIZATION_DEADLINE_MS = 60 * 60_000
const POLL_INTERVAL_MS = 5_000

const DIARIZE_ERROR = 'Não foi possível separar os falantes da gravação.'

type DiarizeRequestOptions = {
  /** Called after each poll — lets the job keep its heartbeat alive. */
  onProgress?: () => Promise<void> | void
  /** Poll cadence; only tests change it (default 5 s). */
  pollIntervalMs?: number
}

type DiarizeResult =
  | { ok: true; turns: DiarizedTurn[] }
  | { ok: false; error: string; status: number }

/** The seam the transcription job consumes; tests inject a fake. */
export type SpeakerDiarizer = (
  file: Blob,
  options?: DiarizeRequestOptions,
) => Promise<DiarizeResult>

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const authHeaders = (apiKey: string, json = false): Record<string, string> => ({
  authorization: apiKey,
  ...(json ? { 'content-type': 'application/json' } : {}),
})

/** `A`→`speaker-A`… provider cluster ids stay opaque; the pure module numbers them. */
const normalizeUtterances = (json: unknown): DiarizedTurn[] => {
  const data = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const utterances = Array.isArray(data.utterances) ? data.utterances : []
  const turns: DiarizedTurn[] = []
  for (const raw of utterances) {
    const utterance = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const speaker = typeof utterance.speaker === 'string' ? utterance.speaker.trim() : ''
    const startMs = Number(utterance.start)
    const endMs = Number(utterance.end)
    if (!speaker || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    turns.push({
      speaker,
      startSeconds: Math.max(0, startMs / 1000),
      endSeconds: Math.max(0, endMs / 1000),
    })
  }
  return turns
}

/** Best-effort delete of the remote transcript (privacy hygiene, never fatal). */
const deleteRemoteTranscript = async (apiKey: string, transcriptId: string): Promise<void> => {
  try {
    await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`, {
      method: 'DELETE',
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(POLL_REQUEST_TIMEOUT_MS),
    })
  } catch {
    // Best-effort: a failed delete never affects the recording.
  }
}

/**
 * Uploads the audio, submits the diarization transcript and polls until it is
 * ready. `file` is a Blob opened from the extracted MP3 (the job owns the temp
 * file); the provider call itself keeps no copy after the best-effort delete.
 */
export const assemblyAiDiarize: SpeakerDiarizer = async (
  file,
  { onProgress, pollIntervalMs = POLL_INTERVAL_MS } = {},
) => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Separação de falantes está indisponível no momento.', status: 503 }
  }

  let transcriptId: string | null = null
  try {
    const uploadResponse = await fetch(ASSEMBLYAI_UPLOAD_URL, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: file,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })
    if (!uploadResponse.ok) return { ok: false, error: DIARIZE_ERROR, status: 502 }

    const uploaded = (await uploadResponse.json()) as { upload_url?: unknown }
    const uploadUrl = typeof uploaded.upload_url === 'string' ? uploaded.upload_url : ''
    if (!uploadUrl) return { ok: false, error: DIARIZE_ERROR, status: 502 }

    const createResponse = await fetch(ASSEMBLYAI_TRANSCRIPT_URL, {
      method: 'POST',
      headers: authHeaders(apiKey, true),
      body: JSON.stringify({
        audio_url: uploadUrl,
        language_code: ASSEMBLYAI_LANGUAGE,
        speaker_labels: true,
        speech_models: [ASSEMBLYAI_MODEL],
      }),
      signal: AbortSignal.timeout(POLL_REQUEST_TIMEOUT_MS),
    })
    if (!createResponse.ok) return { ok: false, error: DIARIZE_ERROR, status: 502 }

    const created = (await createResponse.json()) as { id?: unknown; status?: unknown }
    transcriptId = typeof created.id === 'string' ? created.id : null
    if (!transcriptId) return { ok: false, error: DIARIZE_ERROR, status: 502 }

    const deadline = Date.now() + DIARIZATION_DEADLINE_MS
    for (;;) {
      await sleep(pollIntervalMs)
      await onProgress?.()

      const pollResponse = await fetch(`${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`, {
        headers: authHeaders(apiKey),
        signal: AbortSignal.timeout(POLL_REQUEST_TIMEOUT_MS),
      })
      if (!pollResponse.ok) return { ok: false, error: DIARIZE_ERROR, status: 502 }

      const transcript = (await pollResponse.json()) as { status?: unknown }
      if (transcript.status === 'completed') {
        await deleteRemoteTranscript(apiKey, transcriptId)
        return { ok: true, turns: normalizeUtterances(transcript) }
      }
      if (transcript.status === 'error') {
        await deleteRemoteTranscript(apiKey, transcriptId)
        return { ok: false, error: DIARIZE_ERROR, status: 502 }
      }
      if (Date.now() > deadline) {
        await deleteRemoteTranscript(apiKey, transcriptId)
        return { ok: false, error: DIARIZE_ERROR, status: 504 }
      }
    }
  } catch {
    if (transcriptId) await deleteRemoteTranscript(apiKey, transcriptId)
    return { ok: false, error: DIARIZE_ERROR, status: 502 }
  }
}

/**
 * The configured provider, or null when the key is absent. The job treats null
 * as "no diarization step": the transcript is still saved, without groups.
 */
export const configuredSpeakerDiarizer = (): SpeakerDiarizer | null =>
  process.env.ASSEMBLYAI_API_KEY ? assemblyAiDiarize : null

/** Opens the extracted MP3 as a Blob without loading hours of audio in memory. */
export const diarizeInputBlob = (path: string): Promise<Blob> =>
  openAsBlob(path, { type: 'audio/mpeg' })
