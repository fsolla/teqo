/** Client-safe quick-action path helpers for the B84+ vertical registries. */

export const ACTIVITY_LIST_PATH = '/campanha/atividades' as const

export const ACTIVITY_NEW_PATH = '/campanha/atividades/nova' as const

export const ACTIVITY_TOUR_COMPOSER_PATH = '/campanha/atividades/giros' as const

export const ORGANIZATIONS_LIST_PATH = '/campanha/organizacoes' as const

export const ORGANIZATION_NEW_PATH = '/campanha/organizacoes/nova' as const

export type ActivityQuickActionSurface = { kind: 'list' } | { kind: 'detail'; activitySlug: string }

export type OrganizationQuickActionSurface =
  | { kind: 'list' }
  | { kind: 'detail'; organizationSlug: string }

/**
 * Strips a single trailing slash for client-side path comparisons, preserving `/`.
 * Homes in this codebase are never `/`, so `/campanha/` → `/campanha` while `/` stays `/`.
 */
export const normalizePathname = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

/** Whether `pathname` is exactly `home`, with an optional trailing slash (list pages). */
export const isListPath = (pathname: string, home: string): boolean =>
  normalizePathname(pathname) === home

const listDetailSlug = (
  pathname: string,
  listPath: string,
  excludedSegments: readonly string[],
): string | null => {
  const prefix = `${listPath}/`
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  if (!rest || rest.includes('/')) return null
  if (excludedSegments.includes(rest)) return null
  return rest
}

const activityDetailSlug = (pathname: string): string | null =>
  listDetailSlug(pathname, ACTIVITY_LIST_PATH, ['nova', 'giros'])

export const parseActivityQuickActionSurface = (
  pathname: string,
): ActivityQuickActionSurface | null => {
  const normalized = normalizePathname(pathname)
  if (normalized === ACTIVITY_LIST_PATH) return { kind: 'list' }
  const slug = activityDetailSlug(normalized)
  return slug ? { kind: 'detail', activitySlug: slug } : null
}

export const parseOrganizationQuickActionSurface = (
  pathname: string,
): OrganizationQuickActionSurface | null => {
  const normalized = normalizePathname(pathname)
  if (normalized === ORGANIZATIONS_LIST_PATH) return { kind: 'list' }
  const slug = listDetailSlug(normalized, ORGANIZATIONS_LIST_PATH, ['nova'])
  return slug ? { kind: 'detail', organizationSlug: slug } : null
}

export const isActivityTourComposerPath = (pathname: string): boolean =>
  normalizePathname(pathname) === ACTIVITY_TOUR_COMPOSER_PATH
