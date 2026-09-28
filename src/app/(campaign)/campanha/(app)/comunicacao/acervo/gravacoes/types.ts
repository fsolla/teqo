import type { RecordingViewModel } from '@/lib/recording'

/**
 * Wire contract of `POST .../gravacoes/enviar` (C199-fix) — starts a chunked
 * upload and returns the part size the dialog must slice with.
 */
export type RecordingUploadStartResponse =
  | { status: 'success'; recording: RecordingViewModel; chunkSize: number }
  | { status: 'error'; message: string }

/**
 * Wire contract of `POST .../gravacoes/enviar/[id]?index=N` (C199-fix) — one
 * raw-body part; the part that completes the declared size finalizes the
 * upload and carries the recording.
 */
export type RecordingChunkResponse =
  | { status: 'success'; done: false }
  | { status: 'success'; done: true; recording: RecordingViewModel }
  | { status: 'error'; message: string }

/**
 * Wire contract of `DELETE .../gravacoes/enviar/[id]` (C199-fix) — aborts an
 * in-flight upload (temp session + `uploading` row); idempotent, a finalized
 * recording is never touched.
 */
export type RecordingUploadAbortResponse =
  | { status: 'success'; aborted: true }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../gravacoes/status` (C199) — status poll. */
export type RecordingStatusResponse =
  | { status: 'success'; recordings: RecordingViewModel[] }
  | { status: 'error'; message: string }

/** Wire contract of `DELETE .../gravacoes/[id]/apagar` (C199) — hard delete. */
export type RecordingDeleteResponse =
  | { status: 'success'; deleted: true }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../gravacoes/[id]/retry` (C199) — retry failed ASR. */
export type RecordingRetryResponse =
  | { status: 'success'; recording: RecordingViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../gravacoes/[id]/falantes` (C200) — label a cluster. */
export type RecordingSpeakerLabelResponse =
  | { status: 'success'; labeled: true }
  | { status: 'error'; message: string }
