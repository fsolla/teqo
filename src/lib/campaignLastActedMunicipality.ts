/** Device-local last municipality where the staff actor completed a wizard write. */

export const LAST_ACTED_MUNICIPALITY_STORAGE_KEY = 'teqo:campaign:last-acted-municipality'

const isStoredSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const getLastActedMunicipalitySlug = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LAST_ACTED_MUNICIPALITY_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isStoredSlug(parsed)) return parsed.trim()
    return null
  } catch {
    return null
  }
}

export const recordLastActedMunicipality = (slug: string): void => {
  if (typeof window === 'undefined') return
  const trimmed = slug.trim()
  if (!trimmed) return
  try {
    localStorage.setItem(LAST_ACTED_MUNICIPALITY_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export const clearLastActedMunicipality = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LAST_ACTED_MUNICIPALITY_STORAGE_KEY)
  } catch {
    // Ignore private-mode failures.
  }
}
