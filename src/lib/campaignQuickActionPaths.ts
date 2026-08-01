/** Client-safe `/campanha/atividades` path helpers for the B84 quick-action registry. */

export const ACTIVITY_LIST_PATH = '/campanha/atividades' as const

export const ACTIVITY_NEW_PATH = '/campanha/atividades/nova' as const

export const ACTIVITY_TOUR_COMPOSER_PATH = '/campanha/atividades/giros' as const

export type ActivityQuickActionSurface =
  | { kind: 'list' }
  | { kind: 'detail'; activitySlug: string }

const normalizePathname = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

const activityDetailSlug = (pathname: string): string | null => {
  const prefix = `${ACTIVITY_LIST_PATH}/`
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  if (!rest || rest.includes('/')) return null
  if (rest === 'nova' || rest === 'giros') return null
  return rest
}

export const parseActivityQuickActionSurface = (
  pathname: string,
): ActivityQuickActionSurface | null => {
  const normalized = normalizePathname(pathname)
  if (normalized === ACTIVITY_LIST_PATH) return { kind: 'list' }
  const slug = activityDetailSlug(normalized)
  return slug ? { kind: 'detail', activitySlug: slug } : null
}

export const isActivityTourComposerPath = (pathname: string): boolean =>
  normalizePathname(pathname) === ACTIVITY_TOUR_COMPOSER_PATH
