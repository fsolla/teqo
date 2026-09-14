import type { SpeechVodResolution } from '@/lib/speechVod'

/** Wire contract of `POST /campanha/comunicacao/acervo/resolver-vod` (C162). */
export type SpeechVodResolveResponse =
  | { status: 'success'; resolution: SpeechVodResolution }
  | { status: 'error'; message: string }
