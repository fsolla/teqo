import type { SpeechCutViewModel } from '@/lib/speechCut'
import type { SpeechCutMetadataSuggestion } from '@/utilities/speech/speechCutMetadata'

/** Wire contract of `POST /campanha/comunicacao/acervo/cortar` (C167). */
export type SpeechCutSaveResponse =
  | { status: 'success'; cut: SpeechCutViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST /campanha/comunicacao/acervo/cortar/status` (C167). */
export type SpeechCutStatusResponse =
  | { status: 'success'; cut: SpeechCutViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST /campanha/comunicacao/acervo/cortar/sugestao` (C167). */
export type SpeechCutSuggestionResponse =
  | { status: 'success'; suggestion: SpeechCutMetadataSuggestion }
  | { status: 'error'; message: string }
