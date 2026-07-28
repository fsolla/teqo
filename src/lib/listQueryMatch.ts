/**
 * Whether two list hrefs point at the same recorte.
 *
 * This exists as string comparison rather than a re-serialization through the
 * domain's canonical builder because its caller is the campaign sidebar, which
 * lives in the `(app)` layout and therefore ships on the First Load JS of every
 * `/campanha` route: importing `buildMunicipalityListHref` there would drag
 * `bahiaTerritories` + `municipalityCatalog` along with it (~21 kB, measured in
 * B14).
 */

const HREF_BASE = 'https://list-query-match.invalid'

const parseHref = (href: string): { pathname: string; search: URLSearchParams } | null => {
  try {
    // A base makes relative hrefs parseable and normalizes percent-encoding on
    // both sides, so `?q=ita%C3%BAna` and `?q=itaúna` are the same recorte.
    const url = new URL(href, HREF_BASE)
    return { pathname: url.pathname, search: url.searchParams }
  } catch {
    return null
  }
}

const queryKey = (search: URLSearchParams, ignoredParams: readonly string[]): string => {
  const pairs: string[] = []
  for (const [name, value] of search) {
    if (ignoredParams.includes(name)) continue
    pairs.push(`${name}=${value}`)
  }
  // Sorted so param order never decides the answer, and repeated params
  // (`?region=A&region=B`) compare as the set they encode.
  return pairs.sort().join('&')
}

export const isSameListHref = (
  left: string,
  right: string,
  ignoredParams: readonly string[] = [],
): boolean => {
  const parsedLeft = parseHref(left)
  const parsedRight = parseHref(right)
  if (!parsedLeft || !parsedRight) return false
  if (parsedLeft.pathname !== parsedRight.pathname) return false
  return queryKey(parsedLeft.search, ignoredParams) === queryKey(parsedRight.search, ignoredParams)
}
