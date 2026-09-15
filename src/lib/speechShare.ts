/**
 * C166 — pure share text for an acervo excerpt: the YouTube watch URL opening
 * at the picked point (session offset + excerpt start, whole seconds) and the
 * message that carries the interval, since YouTube cannot encode the end. The
 * WhatsApp URL reuses the repo's recipient-less `wa.me` builder.
 */
import { buildWhatsAppTextShareUrl } from '@/lib/phone'
import { formatSpeechClock } from '@/lib/speechClock'

const EXCERPT_SHARE_FALLBACK_TYPE = 'fala'

export type SpeechExcerptShareInput = {
  videoId: string
  /** Session offset in seconds; null means unknowable and the link carries no `t=`. */
  offsetSeconds: number | null
  startSeconds: number
  endSeconds: number
  speechType: string | null
  /** Day label (`dd/mm/aaaa`) of the speech. */
  dateLabel: string
}

export type SpeechExcerptShare = {
  url: string
  message: string
  whatsAppUrl: string
}

/** `https://www.youtube.com/watch?v=<id>&t=<segundos>` — no `t=` when the offset is unknown. */
export const buildSpeechExcerptYoutubeUrl = (
  videoId: string,
  offsetSeconds: number | null,
  startSeconds: number,
): string => {
  const url = new URL('https://www.youtube.com/watch')
  url.searchParams.set('v', videoId)
  if (offsetSeconds !== null && Number.isFinite(offsetSeconds)) {
    url.searchParams.set(
      't',
      String(Math.max(0, Math.floor(offsetSeconds + Math.max(0, startSeconds)))),
    )
  }
  return url.toString()
}

export const buildSpeechExcerptMessage = ({
  speechType,
  dateLabel,
  startSeconds,
  endSeconds,
  url,
}: Omit<SpeechExcerptShareInput, 'videoId' | 'offsetSeconds'> & { url: string }): string =>
  `Trecho de ${speechType?.trim() || EXCERPT_SHARE_FALLBACK_TYPE} (${dateLabel}): de ${formatSpeechClock(startSeconds)} a ${formatSpeechClock(endSeconds)} ${url}`

export const buildSpeechExcerptShare = (input: SpeechExcerptShareInput): SpeechExcerptShare => {
  const { videoId, offsetSeconds, startSeconds, endSeconds, speechType, dateLabel } = input
  const url = buildSpeechExcerptYoutubeUrl(videoId, offsetSeconds, startSeconds)
  const message = buildSpeechExcerptMessage({
    speechType,
    dateLabel,
    startSeconds,
    endSeconds,
    url,
  })
  return { url, message, whatsAppUrl: buildWhatsAppTextShareUrl(message) }
}
