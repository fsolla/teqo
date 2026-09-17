import {
  type InstitutionCatalogEntry,
  institutionCatalog,
  institutionSpellings,
} from '@/lib/institutionCatalog'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

/**
 * Institution-name resolution for the institutional dossiê (C187). Mirrors the
 * `resolveMunicipalityName` fold: accent/case/punctuation-insensitive lookup
 * over the catalog's canonical name + aliases. Returns null when unknown — the
 * caller keeps the fail-closed policy (skill resolves aliases, never invents a
 * slug). A fold shared by two different entries is treated as ambiguous (null),
 * so the operator must pass the canonical slug.
 */

const entriesBySearchValue = new Map<string, Set<InstitutionCatalogEntry>>()

const register = (spelling: string, entry: InstitutionCatalogEntry) => {
  const key = normalizeSearchPhrase(spelling)
  if (!key) return
  const bucket = entriesBySearchValue.get(key)
  if (bucket) bucket.add(entry)
  else entriesBySearchValue.set(key, new Set([entry]))
}

for (const entry of institutionCatalog) {
  register(entry.slug, entry)
  for (const spelling of institutionSpellings(entry)) register(spelling, entry)
}

/**
 * Resolve a token (slug, canonical name or alias) to its catalog entry. Returns
 * null when unknown or when the fold is ambiguous.
 */
export const resolveInstitutionEntry = (
  value: string | undefined | null,
): InstitutionCatalogEntry | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const bucket = entriesBySearchValue.get(normalizeSearchPhrase(trimmed))
  if (!bucket || bucket.size !== 1) return null
  return [...bucket][0] ?? null
}

/** Canonical name for a token, or null when unknown/ambiguous. */
export const resolveInstitutionName = (value: string | undefined | null): string | null =>
  resolveInstitutionEntry(value)?.name ?? null
