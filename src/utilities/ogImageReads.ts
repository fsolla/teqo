import 'server-only'

import type { Media } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documentReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { resolveDeploymentOrigin, resolveSiteMetadata, toAbsoluteUrl } from '@/utilities/seo'

/**
 * A page's own OG image: an upload (`Media`), a bare upload id (depth-0 reads
 * and poisoned cache entries) or an already-resolved URL string.
 */
export type OgImageSource = Media | number | string | null | undefined

export type ResolvedOgImage = {
  /**
   * Absolute URL — app paths resolved on the deployment origin; an
   * already-absolute URL (e.g. a YouTube thumbnail) passes through. `null`
   * when nothing resolved.
   */
  url: string | null
  /** The chosen `Media` when the source is an upload; `null` for URL sources. */
  media: Media | null
}

const mediaOf = (value: OgImageSource): Media | null =>
  typeof value === 'object' && value !== null ? value : null

const resolveMediaSource = async (value: OgImageSource): Promise<Media | null> =>
  typeof value === 'number' ? getCachedDocumentById('media', String(value))() : mediaOf(value)

/**
 * Absolute URL on the deployment origin. An already-absolute URL (e.g. a
 * YouTube thumbnail) passes through; a relative path needs an origin — never a
 * relative URL the WhatsApp crawler cannot resolve.
 */
const absolutize = (url: string | null | undefined, origin: string | null): string | null => {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (origin) return toAbsoluteUrl(trimmed, origin)
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

/**
 * Single owner of the public frontend's OG image fallback: the page's own
 * image when it has a usable URL, otherwise the site default image of the
 * `metadata` global (resolving the id when the read came back at depth 0).
 *
 * Media lives behind this app's `/api/media/file/…` proxy, so asset URLs are
 * built on the deployment origin (`NEXT_PUBLIC_SITE_URL`), never on the
 * `metadata` global `URL`: the global can be a canonical domain served by
 * another platform (today the legacy WordPress), which 404s the proxy path and
 * makes WhatsApp drop the thumbnail. The global `siteUrl` is the fallback when
 * the env is missing.
 *
 * `media` is the resolved upload when the chosen source is one, so call sites
 * that emit width/height/alt/mimeType keep the full document; URL-only sources
 * return `media: null`. Canonical and JSON-LD `url` are NOT this module's
 * business — they keep the global-first chain of `resolveSiteMetadata`.
 */
export const resolveOgImage = async (configured: OgImageSource): Promise<ResolvedOgImage> => {
  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl } = resolveSiteMetadata(globalMetadata)
  const deploymentOrigin = resolveDeploymentOrigin(siteUrl)

  const configuredMedia = await resolveMediaSource(configured)
  const configuredUrl = absolutize(
    typeof configured === 'string' ? configured : configuredMedia?.url,
    deploymentOrigin,
  )
  if (configuredUrl) return { url: configuredUrl, media: configuredMedia }

  const fallbackMedia = await resolveMediaSource(globalMetadata.image)
  const fallbackUrl = absolutize(fallbackMedia?.url, deploymentOrigin)

  return { url: fallbackUrl, media: fallbackUrl ? fallbackMedia : null }
}
