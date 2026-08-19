import { buildWhatsAppTextShareUrl } from '@/lib/phone'

/** Content source of a home content card — drives the share message template. */
export type ContentShareKind = 'article' | 'video' | 'instagram'

/**
 * Message opener per source (S4 acceptance, decision B): article shares "isso",
 * YouTube "esse vídeo", Instagram "esse post". The rest of the message is
 * always "{title} — {link}".
 */
export const CONTENT_SHARE_PREFIXES: Record<ContentShareKind, string> = {
  article: 'Olha isso do Solla: ',
  video: 'Olha esse vídeo do Solla: ',
  instagram: 'Olha esse post do Solla: ',
}

/** Pre-configured share message: opener + title + absolute link. */
export const buildContentShareMessage = (
  kind: ContentShareKind,
  title: string,
  link: string,
): string => `${CONTENT_SHARE_PREFIXES[kind]}${title} — ${link}`

/**
 * Resolve the shared link to an absolute URL against the visitor's origin.
 * Article paths are relative (`/noticia/saude/<slug>`); YouTube/Instagram
 * hrefs are already absolute and pass through unchanged. Fail-soft on a
 * malformed href (a bad feed permalink must degrade the share link, never
 * crash the whole home section).
 */
export const buildContentShareLink = (href: string, origin: string): string => {
  try {
    return new URL(href, origin).toString()
  } catch {
    return href
  }
}

/**
 * `wa.me` URL with the pre-filled message — the sender's own WhatsApp, no
 * recipient phone (reuses the `phone.ts` text-share builder). Callers must
 * open it in a new tab with `noopener noreferrer`.
 */
export const buildContentShareWhatsAppUrl = (
  kind: ContentShareKind,
  title: string,
  link: string,
): string => buildWhatsAppTextShareUrl(buildContentShareMessage(kind, title, link))
