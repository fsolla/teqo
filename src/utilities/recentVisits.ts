export const STORAGE_KEY = 'teqo:campaign:recent-visits'
export const MAX_ENTRIES = 8
export const RECORD_DWELL_MS = 2000

type RecentVisitKind = 'municipality' | 'municipalityList'

export type RecentVisitEntry = {
  href: string
  label: string
  kind: RecentVisitKind
  visitedAt: number
}

const isRecentVisitEntry = (value: unknown): value is RecentVisitEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.href === 'string' &&
    entry.href.length > 0 &&
    typeof entry.label === 'string' &&
    entry.label.length > 0 &&
    (entry.kind === 'municipality' || entry.kind === 'municipalityList') &&
    typeof entry.visitedAt === 'number' &&
    Number.isFinite(entry.visitedAt)
  )
}

export const listRecentVisits = (): RecentVisitEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentVisitEntry)
  } catch {
    return []
  }
}

export const recordRecentVisit = (entry: RecentVisitEntry): void => {
  if (typeof window === 'undefined') return
  try {
    const existing = listRecentVisits()
    const deduped = existing.filter((item) => item.href !== entry.href)
    const next = [entry, ...deduped].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export const clearRecentVisits = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore private-mode failures.
  }
}
