import { resolveCalendarEventWindow } from '@/lib/calendarEvent'
import {
  normalizeAbsoluteHttpUrl,
  resolveShareLinkYoutubeVideoId,
  YOUTUBE_HOSTS,
  type ShareLinkDestinationLike,
  type ShareLinkLiveTarget,
} from '@/lib/shareLink'
import {
  buildShareLinkAnnouncementView,
  type ShareLinkAnnouncementSource,
  type ShareLinkAnnouncementView,
} from '@/lib/shareLinkAnnouncement'

/**
 * S44 — the pure contract of the home section that announces the Plenária da
 * Vitória. The section reflects the state of one fixed share link: while the
 * event window is open it renders the announcement view (image + agenda before
 * the broadcast; YouTube embed + entry CTA while on air), and it disappears
 * (fail-closed) once the link is unpublished or the window closes. No Payload
 * import here — the server read orchestrates and hands over a serializable view.
 */

export const SHARE_LINK_HOME_SECTION_SLUG = 'plenaria-vitoria'

export type ShareLinkHomeSectionSource = ShareLinkAnnouncementSource & {
  destinations?: ShareLinkDestinationLike[] | null
}

export type ShareLinkHomeSectionView = ShareLinkAnnouncementView & {
  /** Epoch ms when the event window closes (`endsAt`, else `startsAt` + 2h). */
  expiresAt: number
  /** Video id of the link's pre-registered YouTube destination, when there is one. */
  youtubeVideoId: string | null
}

/**
 * The visibility window is the S29 calendar window (the same 2h fallback
 * duration): no valid `startsAt` means no event window, and a closed window
 * hides the section entirely — never a stale promo.
 */
export const buildShareLinkHomeSectionView = ({
  link,
  imageUrl,
  canonicalUrl,
  nowMs,
}: {
  link: ShareLinkHomeSectionSource
  imageUrl: string | null
  canonicalUrl: string | null
  nowMs: number
}): ShareLinkHomeSectionView | null => {
  const window = resolveCalendarEventWindow(link.startsAt, link.endsAt)
  if (!window || nowMs >= window.end.getTime()) return null

  return {
    ...buildShareLinkAnnouncementView({ link, imageUrl, canonicalUrl }),
    expiresAt: window.end.getTime(),
    youtubeVideoId: resolveShareLinkYoutubeVideoId(link.destinations),
  }
}

const MEET_HOST = 'meet.google.com'

/**
 * S44 — the entry CTA label follows the destination on air (design gate): the
 * Google Meet is "Entrar na plenária", the YouTube is "Assistir no YouTube".
 * The host is the source of truth (a relabeled destination never mislabels the
 * button); anything else falls back to the S29 generic "Entrar".
 */
export const resolveShareLinkLiveActionLabel = (target: ShareLinkLiveTarget): string => {
  const url = normalizeAbsoluteHttpUrl(target.href)
  if (!url) return 'Entrar'

  const host = new URL(url).hostname.replace(/^www\./, '')
  if (host === MEET_HOST) return 'Entrar na plenária'
  if (host === 'youtu.be' || (YOUTUBE_HOSTS as readonly string[]).includes(host)) {
    return 'Assistir no YouTube'
  }

  return 'Entrar'
}
