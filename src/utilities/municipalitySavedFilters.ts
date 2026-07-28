/**
 * Named bookmarks of the municipality list URL (B18).
 *
 * Device-local on purpose: a nav shortcut never has to reach the RSC render, so
 * this is `localStorage` — the same call `recentVisits.ts` made, and unlike
 * B17's column cookie, which the server reads to filter columns.
 *
 * The canonical href IS the identity. One shortcut per recorte, so re-saving a
 * slice that is already stored renames it instead of growing a second submenu
 * row that navigates to the same place.
 */

export const STORAGE_KEY = 'teqo:campaign:municipality-saved-filters'

/**
 * A named bookmark is not a history entry: at the cap the save is refused with
 * a reason instead of silently evicting something the user deliberately named
 * (which is what `recentVisits`'s `slice` does, correctly, for dwell history).
 */
export const MAX_ENTRIES = 12

export const MAX_NAME_LENGTH = 60

/**
 * Two islands share this store — the filter bar writes it, the sidebar reads it
 * — and they never share a React tree, so a write has to announce itself. The
 * native `storage` event covers other tabs and deliberately does not fire in the
 * tab that wrote, which is exactly the half this event adds.
 */
const CHANGE_EVENT = 'teqo:campaign:municipality-saved-filters-change'

export type MunicipalitySavedFilter = {
  /** Canonical list href (page 1, no `compare`) — also the entry's identity. */
  href: string
  name: string
}

export type SaveMunicipalitySavedFilterResult = 'saved' | 'limit' | 'failed'

const EMPTY: readonly MunicipalitySavedFilter[] = Object.freeze([])

/**
 * `useSyncExternalStore` compares snapshots by reference, so parsing storage on
 * every `getSnapshot` call would render forever. The cache is dropped by every
 * write and by a `storage` event from another tab.
 */
let snapshot: readonly MunicipalitySavedFilter[] | null = null

const isMunicipalitySavedFilter = (value: unknown): value is MunicipalitySavedFilter => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.href === 'string' &&
    entry.href.startsWith('/campanha/municipios') &&
    typeof entry.name === 'string' &&
    entry.name.trim().length > 0
  )
}

/**
 * Alphabetical, not by recency: a named shortcut that reorders itself under the
 * cursor every time it is re-saved is a nav bug. Recency is Visitados' job.
 */
const byName = (left: MunicipalitySavedFilter, right: MunicipalitySavedFilter): number =>
  left.name.localeCompare(right.name, 'pt-BR')

const read = (): readonly MunicipalitySavedFilter[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY
    const seen = new Set<string>()
    const entries = parsed.filter(isMunicipalitySavedFilter).filter((entry) => {
      if (seen.has(entry.href)) return false
      seen.add(entry.href)
      return true
    })
    return entries.length ? entries.slice(0, MAX_ENTRIES).sort(byName) : EMPTY
  } catch {
    return EMPTY
  }
}

export const listMunicipalitySavedFilters = (): readonly MunicipalitySavedFilter[] => {
  if (typeof window === 'undefined') return EMPTY
  snapshot ??= read()
  return snapshot
}

const write = (entries: readonly MunicipalitySavedFilter[]): boolean => {
  let persisted = true
  try {
    if (entries.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Quota or private mode. Readers are told to re-read either way, so the
    // submenu shows what actually persisted rather than a save that did not.
    persisted = false
  }
  snapshot = null
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return persisted
}

export const saveMunicipalitySavedFilter = (
  entry: MunicipalitySavedFilter,
): SaveMunicipalitySavedFilterResult => {
  if (typeof window === 'undefined') return 'failed'
  const name = entry.name.trim().slice(0, MAX_NAME_LENGTH)
  if (!name) return 'failed'
  const others = listMunicipalitySavedFilters().filter((item) => item.href !== entry.href)
  // Renaming at the cap has to keep working, which is why the ceiling is checked
  // against the OTHER entries and not against the stored length.
  if (others.length >= MAX_ENTRIES) return 'limit'
  return write([...others, { href: entry.href, name }].sort(byName)) ? 'saved' : 'failed'
}

export const removeMunicipalitySavedFilter = (href: string): void => {
  if (typeof window === 'undefined') return
  const existing = listMunicipalitySavedFilters()
  const next = existing.filter((item) => item.href !== href)
  if (next.length === existing.length) return
  write(next)
}

export const clearMunicipalitySavedFilters = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(OPEN_STORAGE_KEY)
  } catch {
    // Same reason as below: the preference is a nicety.
  }
  write([])
}

const OPEN_STORAGE_KEY = 'teqo:campaign:municipality-saved-filters-open'

/**
 * The submenu's disclosure. Open by default — a shortcut nobody can see is a
 * shortcut nobody uses, and the group only exists once something is in it.
 */
export const readMunicipalitySavedFiltersOpen = (): boolean => {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export const writeMunicipalitySavedFiltersOpen = (open: boolean): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OPEN_STORAGE_KEY, open ? 'true' : 'false')
  } catch {
    // A remembered disclosure is a nicety; a full quota must not break the
    // toggle itself, which works from React state either way.
  }
}

export const subscribeMunicipalitySavedFilters = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  const handleChange = (event: Event) => {
    // `storage` fires for every key in the origin (recent visits, biometrics
    // flags); a null key means the whole store was cleared.
    if (event instanceof StorageEvent && event.key !== null && event.key !== STORAGE_KEY) return
    snapshot = null
    onChange()
  }
  window.addEventListener(CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleChange)
  }
}
