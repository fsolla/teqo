/**
 * Device-local named bookmarks of a list URL (B18 pattern, 2nd call site: C100).
 *
 * The municipality store was the first call site; the semantics are subtle
 * enough that a second copy would rot independently (rename-at-cap, the
 * cross-island change event, the snapshot cache), so the storage layer is this
 * one factory and each list keeps a thin domain module over it. The FD2 veto
 * is about a GENERIC saved-filters SYSTEM (server-sync, config-driven) — a
 * shared storage primitive with two concrete stores is the edit-the-owner
 * move, not that system.
 *
 * The canonical href IS the entry's identity: one shortcut per recorte, and
 * re-saving a slice that is already stored renames it instead of growing a
 * second row that navigates to the same place.
 */

export const SAVED_FILTER_MAX_ENTRIES = 12

export const SAVED_FILTER_MAX_NAME_LENGTH = 60

export type CampaignSavedFilter = {
  /** Canonical list href (page 1) — also the entry's identity. */
  href: string
  name: string
}

export type SaveCampaignSavedFilterResult = 'saved' | 'limit' | 'failed'

export type CampaignSavedFilterStoreOptions = {
  storageKey: string
  /** Rejects entries from another list (the href prefix is the guard). */
  isHrefValid: (href: string) => boolean
}

export type CampaignSavedFilterStore = {
  list: () => readonly CampaignSavedFilter[]
  save: (entry: CampaignSavedFilter) => SaveCampaignSavedFilterResult
  remove: (href: string) => void
  clear: () => void
  subscribe: (onChange: () => void) => () => void
}

export const createSavedFilterStore = ({
  storageKey,
  isHrefValid,
}: CampaignSavedFilterStoreOptions): CampaignSavedFilterStore => {
  /**
   * Two islands share a store — the filter bar writes it, the sidebar reads it
   * — and they never share a React tree, so a write has to announce itself.
   * The native `storage` event covers other tabs and deliberately does not
   * fire in the tab that wrote, which is exactly the half this event adds.
   */
  const changeEvent = `${storageKey}-change`

  const empty: readonly CampaignSavedFilter[] = Object.freeze([])

  /**
   * `useSyncExternalStore` compares snapshots by reference, so parsing storage
   * on every `getSnapshot` call would render forever. The cache is dropped by
   * every write and by a `storage` event from another tab.
   */
  let snapshot: readonly CampaignSavedFilter[] | null = null

  const isEntry = (value: unknown): value is CampaignSavedFilter => {
    if (!value || typeof value !== 'object') return false
    const entry = value as Record<string, unknown>
    return (
      typeof entry.href === 'string' &&
      isHrefValid(entry.href) &&
      typeof entry.name === 'string' &&
      entry.name.trim().length > 0
    )
  }

  /**
   * Alphabetical, not by recency: a named shortcut that reorders itself under
   * the cursor every time it is re-saved is a nav bug. Recency is Visitados'
   * job.
   */
  const byName = (left: CampaignSavedFilter, right: CampaignSavedFilter): number =>
    left.name.localeCompare(right.name, 'pt-BR')

  const read = (): readonly CampaignSavedFilter[] => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return empty
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return empty
      const seen = new Set<string>()
      const entries = parsed.filter(isEntry).filter((entry) => {
        if (seen.has(entry.href)) return false
        seen.add(entry.href)
        return true
      })
      return entries.length ? entries.slice(0, SAVED_FILTER_MAX_ENTRIES).sort(byName) : empty
    } catch {
      return empty
    }
  }

  const list = (): readonly CampaignSavedFilter[] => {
    if (typeof window === 'undefined') return empty
    snapshot ??= read()
    return snapshot
  }

  const write = (entries: readonly CampaignSavedFilter[]): boolean => {
    let persisted = true
    try {
      if (entries.length) localStorage.setItem(storageKey, JSON.stringify(entries))
      else localStorage.removeItem(storageKey)
    } catch {
      // Quota or private mode. Readers are told to re-read either way, so the
      // submenu shows what actually persisted rather than a save that did not.
      persisted = false
    }
    snapshot = null
    window.dispatchEvent(new Event(changeEvent))
    return persisted
  }

  const save = (entry: CampaignSavedFilter): SaveCampaignSavedFilterResult => {
    if (typeof window === 'undefined') return 'failed'
    const name = entry.name.trim().slice(0, SAVED_FILTER_MAX_NAME_LENGTH)
    if (!name) return 'failed'
    const others = list().filter((item) => item.href !== entry.href)
    // Renaming at the cap has to keep working, which is why the ceiling is
    // checked against the OTHER entries and not against the stored length.
    if (others.length >= SAVED_FILTER_MAX_ENTRIES) return 'limit'
    return write([...others, { href: entry.href, name }].sort(byName)) ? 'saved' : 'failed'
  }

  const remove = (href: string): void => {
    if (typeof window === 'undefined') return
    const existing = list()
    const next = existing.filter((item) => item.href !== href)
    if (next.length === existing.length) return
    write(next)
  }

  const clear = (): void => {
    if (typeof window === 'undefined') return
    write([])
  }

  const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => {}
    const handleChange = (event: Event) => {
      // `storage` fires for every key in the origin (recent visits, biometrics
      // flags); a null key means the whole store was cleared.
      if (event instanceof StorageEvent && event.key !== null && event.key !== storageKey) return
      snapshot = null
      onChange()
    }
    window.addEventListener(changeEvent, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(changeEvent, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }

  return { list, save, remove, clear, subscribe }
}
