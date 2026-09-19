/**
 * C199 — pure transcription rules of an uploaded recording: the ffmpeg command
 * that extracts and splits the audio, the merge of per-chunk ASR segments into
 * absolute timestamps, and the normalized search text persisted on the row.
 * No I/O: the job is the only impure side and the unit tests read this module.
 */
import { normalizeForSearch } from '@/lib/speechSearch'

/** 20-minute chunks: ≈4,8 MB of 32 kbps mono audio, minutes from any provider cap. */
export const RECORDING_AUDIO_CHUNK_SECONDS = 20 * 60

const RECORDING_AUDIO_SAMPLE_RATE = 16_000
const RECORDING_AUDIO_BITRATE = '32k'

/** One ASR segment as the provider returns it, relative to its chunk. */
export type RecordingChunkSegment = {
  start: number
  end: number
  text: string
}

/** One chunk of the transcription and the absolute offset it starts at. */
export type RecordingChunkTranscription = {
  offsetSeconds: number
  segments: readonly RecordingChunkSegment[]
}

/** One persisted `recordingSegment` row, in absolute seconds. */
export type RecordingTranscriptSegment = {
  order: number
  startSeconds: number
  endSeconds: number
  text: string
}

/**
 * Extracts a mono 16 kHz MP3 and splits it into fixed chunks in one ffmpeg
 * pass. Args are returned as an array — never a shell string; `outputPattern`
 * carries the `%03d` sequence ffmpeg replaces per chunk.
 */
export const buildRecordingAudioFfmpegArgs = ({
  inputPath,
  outputPattern,
}: {
  inputPath: string
  outputPattern: string
}): string[] => [
  '-nostdin',
  '-hide_banner',
  '-y',
  '-i',
  inputPath,
  '-vn',
  '-ac',
  '1',
  '-ar',
  String(RECORDING_AUDIO_SAMPLE_RATE),
  '-c:a',
  'libmp3lame',
  '-b:a',
  RECORDING_AUDIO_BITRATE,
  '-f',
  'segment',
  '-segment_time',
  String(RECORDING_AUDIO_CHUNK_SECONDS),
  '-reset_timestamps',
  '1',
  outputPattern,
]

/**
 * Merges every chunk into one ordered transcript: each segment is shifted by
 * its chunk offset, empty text is dropped and a degenerate span (end before
 * start) is clamped so the clickable transcript never breaks the player.
 * Order is assigned after the merge, so the persisted sequence is contiguous.
 */
export const mergeChunkTranscriptions = (
  chunks: readonly RecordingChunkTranscription[],
): RecordingTranscriptSegment[] => {
  const merged: RecordingTranscriptSegment[] = []
  for (const chunk of chunks) {
    for (const segment of chunk.segments) {
      const text = segment.text.trim()
      if (!text) continue
      const startSeconds = Math.max(0, chunk.offsetSeconds + segment.start)
      const endSeconds = Math.max(startSeconds, chunk.offsetSeconds + segment.end)
      merged.push({
        order: merged.length,
        startSeconds,
        endSeconds,
        text,
      })
    }
  }
  return merged
}

/** The concatenated transcript used by the recording's textual search. */
export const recordingSearchText = (segments: readonly { text: string }[]): string =>
  normalizeForSearch(
    segments
      .map((segment) => segment.text)
      .join(' ')
      .trim(),
  )

type NormalizedTranscription = {
  segments: RecordingChunkSegment[]
  durationSeconds: number | null
}

/**
 * Normalizes a Deep Infra transcription response (ported from the Câmara CLI's
 * `normalizeTranscription`): accepts the OpenAI-compat shape
 * (`segments[{start,end,text}]`) and the native whisper shape
 * (`chunks[{timestamp:[start,end],text}]`). Invalid entries are dropped; a
 * missing `duration` stays null instead of guessing.
 */
export const normalizeRecordingTranscription = (json: unknown): NormalizedTranscription => {
  const data = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const rawSegments = Array.isArray(data.segments)
    ? data.segments
    : Array.isArray(data.chunks)
      ? data.chunks
      : []

  const segments: RecordingChunkSegment[] = []
  for (const raw of rawSegments) {
    const segment = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const timestamps = Array.isArray(segment.timestamp) ? segment.timestamp : null
    const start = Number(segment.start ?? timestamps?.[0])
    const end = Number(segment.end ?? timestamps?.[1])
    const text = typeof segment.text === 'string' ? segment.text.trim() : ''
    if (!Number.isFinite(start) || !Number.isFinite(end) || text === '') continue
    segments.push({ start, end, text })
  }

  const rawDuration = Number(data.duration)
  return {
    segments,
    durationSeconds: Number.isFinite(rawDuration) && rawDuration >= 0 ? rawDuration : null,
  }
}
