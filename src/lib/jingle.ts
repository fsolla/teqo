import { slugify } from '@/lib/slug'

/**
 * S21 — pure shapes of the public jingles page. The server read resolves the
 * cover/audio media and hands the client a serializable view model, so the
 * download name and the fail-closed card rules live here (client-safe, no
 * Payload imports).
 */

export type JingleMedia = {
  url?: string | null
  alt?: string | null
  filename?: string | null
}

export type JingleSource = {
  id: number
  title: string
  slug?: string | null
}

export type JingleViewModel = {
  id: number
  title: string
  coverUrl: string
  coverAlt: string
  audioUrl: string
  downloadFilename: string
}

const DOWNLOAD_PREFIX = 'jorge-solla-1313'
const FALLBACK_SLUG = 'jingle'
const FALLBACK_EXTENSION = 'mp3'

/**
 * Legible download name shown under the button and sent in the `download`
 * attribute: the stored upload filename can carry accents/spaces, so the base
 * comes from the slug and the extension from the actual file (fallback MP3).
 */
export const jingleDownloadFilename = (
  slug: string | null | undefined,
  audioFilename?: string | null,
): string => {
  const base = slugify(slug ?? '') || FALLBACK_SLUG
  const lastDot = audioFilename?.lastIndexOf('.') ?? -1
  const extension = lastDot > 0 ? audioFilename?.slice(lastDot + 1).toLowerCase() : null
  const safeExtension =
    extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : FALLBACK_EXTENSION

  return `${DOWNLOAD_PREFIX}-${base}.${safeExtension}`
}

/**
 * A card only exists when both media are readable: an unpopulated/missing
 * cover or audio fails closed (the jingle is skipped, never rendered broken).
 */
export const toJingleViewModel = ({
  jingle,
  cover,
  audio,
}: {
  jingle: JingleSource
  cover: JingleMedia | null
  audio: JingleMedia | null
}): JingleViewModel | null => {
  if (!cover?.url || !audio?.url) return null

  return {
    id: jingle.id,
    title: jingle.title,
    coverUrl: cover.url,
    coverAlt: cover.alt?.trim() || `Capa do jingle ${jingle.title} de Jorge Solla 1313`,
    audioUrl: audio.url,
    downloadFilename: jingleDownloadFilename(jingle.slug, audio.filename),
  }
}
