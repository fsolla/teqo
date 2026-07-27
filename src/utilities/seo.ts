/** Remove any trailing slash(es) so URLs concatenate predictably. */
export const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

/** Truncate `text` to `max` characters, appending an ellipsis when cut. */
export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

/** Resolve a possibly-relative URL against the site's base URL. */
export const toAbsoluteUrl = (url: string, siteUrl: string): string =>
  /^https?:\/\//i.test(url)
    ? url
    : `${stripTrailingSlash(siteUrl)}${url.startsWith('/') ? '' : '/'}${url}`

/**
 * Join a resolved site origin with a path. Returns `undefined` when there is no
 * site URL so callers can omit canonical / Open Graph url instead of concatenating
 * against `null`.
 */
export const absoluteSitePath = (siteUrl: string | null, path: string): string | undefined => {
  if (!siteUrl) return undefined
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Partial shape of the Payload `metadata` global. Fields are optional because a
 * fresh DB (or a poisoned `unstable_cache` entry) can return an empty object at
 * build time even though the schema marks them required.
 */
export type SiteMetadataSource = {
  URL?: string | null
  title?: string | null
  description?: string | null
  keywords?: ({ keyword?: string | null } | string | null)[] | null
  openGraph?: { siteName?: string | null } | null
  twitter?: { creator?: string | null; description?: string | null } | null
}

/** Defaults shared by every public-site SEO surface when the global is empty. */
export const SITE_METADATA_DEFAULTS = {
  title: 'Jorge Solla',
  siteName: 'Jorge Solla',
  description: 'Notícias, campanhas e a atuação do deputado Jorge Solla pela Bahia.',
  twitterCreator: '@jorgesolla',
} as const

const nonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const resolveSiteUrl = (source: SiteMetadataSource): string | null => {
  const fromGlobal = nonEmpty(source.URL)
  if (fromGlobal) return stripTrailingSlash(fromGlobal)

  const fromEnv = nonEmpty(process.env.NEXT_PUBLIC_SITE_URL)
  if (fromEnv) return stripTrailingSlash(fromEnv)

  return null
}

const flattenKeywords = (source: SiteMetadataSource): string[] =>
  (source.keywords ?? [])
    .map((entry) => nonEmpty(typeof entry === 'string' ? entry : entry?.keyword))
    .filter((keyword): keyword is string => keyword !== null)

/**
 * Resolve site SEO fields with graceful degradation.
 *
 * `siteUrl` is `null` when neither the global nor `NEXT_PUBLIC_SITE_URL` has a
 * usable URL — callers MUST omit canonical / Open Graph url / JSON-LD url in
 * that case rather than concatenate against `undefined`.
 */
export const resolveSiteMetadata = (source: SiteMetadataSource) => ({
  siteUrl: resolveSiteUrl(source),
  title: nonEmpty(source.title) ?? SITE_METADATA_DEFAULTS.title,
  siteName: nonEmpty(source.openGraph?.siteName) ?? SITE_METADATA_DEFAULTS.siteName,
  description: nonEmpty(source.description) ?? SITE_METADATA_DEFAULTS.description,
  twitterCreator: nonEmpty(source.twitter?.creator) ?? SITE_METADATA_DEFAULTS.twitterCreator,
  twitterDescription:
    nonEmpty(source.twitter?.description) ??
    nonEmpty(source.description) ??
    SITE_METADATA_DEFAULTS.description,
  keywords: flattenKeywords(source),
})
