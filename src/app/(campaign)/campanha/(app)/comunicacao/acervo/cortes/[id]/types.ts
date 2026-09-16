import type { SpeechCutViewModel } from '@/lib/speechCut'

/** Wire contract of `POST .../cortes/[id]/texto` (C168) — edit title/description. */
export type SpeechCutTextUpdateResponse =
  | { status: 'success'; cut: SpeechCutViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../cortes/[id]/publicacao` (C168) — kill switch. */
export type SpeechCutPublicationResponse =
  | { status: 'success'; cut: SpeechCutViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `DELETE .../cortes/[id]/apagar` (C183) — hard delete. */
export type SpeechCutDeleteResponse =
  | { status: 'success'; deleted: true }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../cortes/[id]/retry` (C183) — retry a failed cut. */
export type SpeechCutRetryResponse =
  | { status: 'success'; cut: SpeechCutViewModel }
  | { status: 'error'; message: string }
