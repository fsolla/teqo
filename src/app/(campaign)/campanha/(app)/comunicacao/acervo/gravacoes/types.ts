import type { RecordingViewModel } from '@/lib/recording'

/** Wire contract of `POST .../gravacoes/enviar` (C199) — raw-body upload. */
export type RecordingUploadResponse =
  | { status: 'success'; recording: RecordingViewModel }
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
