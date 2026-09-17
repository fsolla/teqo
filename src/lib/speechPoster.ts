/**
 * C182 — pure rules of the acervo list frame: the midpoint of a speech, the
 * deterministic `media` cache name/href and the ffmpeg still command. No I/O
 * and no `server-only`: the view model and the poster job share this module so
 * the "middle of the speech" literal lives in one place.
 */
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { speechExcerptCoordinates, type SpeechVodCoordinatesSource } from '@/lib/speechVod'

/**
 * Offset of the middle of the speech inside its Câmara trecho (the trecho
 * starts at the speech): `durationSeconds / 2`. Null without a usable duration.
 */
export const speechPosterOffsetSeconds = (
  durationSeconds: number | null | undefined,
): number | null => {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) return null
  if (durationSeconds <= 0) return null
  return Math.floor(durationSeconds / 2)
}

/** Everything the poster job and the list need to place the frame. */
export type SpeechPosterTarget = {
  eventId: number
  audioId: number
  excerptTms: number
  offsetSeconds: number
}

type SpeechPosterTargetSource = SpeechVodCoordinatesSource & {
  durationSeconds?: number | null
}

/**
 * The speech has a frame when the Câmara can re-resolve the excerpt
 * (`eventId`/`audioId`/`excerptTMs`) AND the midpoint is known. Unlike the
 * player, a stored VOD link is not required — it is only a cache of a previous
 * resolution. The view model and the job share this one decision.
 */
export const speechPosterTarget = (speech: SpeechPosterTargetSource): SpeechPosterTarget | null => {
  const coordinates = speechExcerptCoordinates(speech)
  if (!coordinates) return null

  const offsetSeconds = speechPosterOffsetSeconds(speech.durationSeconds)
  if (offsetSeconds === null) return null

  return { ...coordinates, offsetSeconds }
}

/** Deterministic `media` filename: the cache key and the idempotence key. */
export const speechPosterFilename = (speechId: number): string => `speech-poster-${speechId}.jpg`

/** Internal route the list thumbnail points at (never a public contract). */
export const speechPosterHref = (speechId: number): string =>
  `${CAMPAIGN_COMMUNICATION_ACERVO}/${speechId}/poster`

type SpeechPosterFfmpegInput = {
  inputPath: string
  outputPath: string
  atSeconds: number
}

/**
 * One still at `atSeconds`: `-ss` before `-i` seeks fast and `-frames:v 1`
 * takes a single frame; `scale=480:-2` keeps it small (the card slot is
 * 128×80, `object-cover` crops). Args as an array — never a shell string.
 */
export const buildSpeechPosterFfmpegArgs = ({
  inputPath,
  outputPath,
  atSeconds,
}: SpeechPosterFfmpegInput): string[] => {
  const at = Math.max(0, Math.round(atSeconds))
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-ss',
    String(at),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    'scale=480:-2',
    '-q:v',
    '2',
    '-an',
    outputPath,
  ]
}
