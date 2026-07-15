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
