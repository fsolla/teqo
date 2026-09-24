/**
 * S37 — static catalog of the public figures the assessoria may mark on a piece
 * ("quem aparece na peça", recorte 2): the state-deputy roster (S30, the
 * campaign's dobradinhas) plus other personalities curated as data. It follows
 * the `institution` mold — free text canonicalized against a catalog — without
 * any new person record: the piece stores display names, never identities.
 *
 * The dobradinha rows are DERIVED from `stateDeputyCatalog` (the roster stays
 * the owner of the 53 names); the slug carries a kind prefix so a personality
 * can never collide with a roster entry. No I/O and no `server-only`: the ficha
 * picker, the collection hook and the unit tests share this module.
 */
import {
  CONTENT_PIECE_PUBLIC_FIGURES_MAX,
  CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH,
} from '@/lib/contentPiece'
import { slugify } from '@/lib/slug'
import { stateDeputyCatalog } from '@/lib/stateDeputyCatalog'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

type PublicFigureKind = 'dobradinha' | 'personalidade'

export type PublicFigureCatalogEntry = {
  /** Catalog identity (`<kind>-<slug>`), never a public URL. */
  slug: string
  /** Display name the piece stores and the public facet shows. */
  name: string
  kind: PublicFigureKind
}

/**
 * Other public figures beyond the dobradinhas roster. Deliberately EMPTY on
 * v1: inventing names would be product data without provenance; a personality
 * is marked as free text and becomes data to curate when the gate asks for it.
 */
export const PUBLIC_FIGURE_PERSONALITIES: readonly string[] = []

const personalitySlug = (name: string): string => `personalidade-${slugify(name)}`

export const publicFigureCatalog: readonly PublicFigureCatalogEntry[] = [
  ...stateDeputyCatalog.map((deputy) => ({
    slug: `estadual-${deputy.slug}`,
    name: deputy.name,
    kind: 'dobradinha' as const,
  })),
  ...PUBLIC_FIGURE_PERSONALITIES.map((name) => ({
    slug: personalitySlug(name),
    name,
    kind: 'personalidade' as const,
  })),
]

const normalizedEntryValues = (entry: PublicFigureCatalogEntry): string[] => [
  normalizeSearchPhrase(entry.name),
  normalizeSearchPhrase(entry.slug),
]

/**
 * Accent/case/punctuation-insensitive search by display name or slug; an empty
 * query keeps all (the picker opens with the roster). Same normalization as
 * `resolvePublicFigureName`, so what the picker finds is what the save
 * canonicalizes. Same contract as the S30 selector.
 */
export const filterPublicFigures = (query: string): readonly PublicFigureCatalogEntry[] => {
  const needle = normalizeSearchPhrase(query)
  if (!needle) return publicFigureCatalog

  return publicFigureCatalog.filter((entry) =>
    normalizedEntryValues(entry).some((value) => value.includes(needle)),
  )
}

/**
 * The canonical display name of a typed value, or null when it matches nothing
 * or more than one catalog entry (ambiguous input is never guessed).
 */
export const resolvePublicFigureName = (value: string): string | null => {
  const normalized = normalizeSearchPhrase(value)
  if (!normalized) return null

  const matches = publicFigureCatalog.filter((entry) =>
    normalizedEntryValues(entry).includes(normalized),
  )
  return matches.length === 1 ? matches[0].name : null
}

/**
 * The canonical list the piece persists: trimmed, catalog spelling when the
 * value resolves, deduped by normalized form, capped. Overlong values are
 * dropped (the field is a display name, not a dump) — the form schema refuses
 * them first on the editable path.
 */
export const normalizeContentPiecePublicFigures = (values: readonly string[]): string[] => {
  const seen = new Set<string>()
  const figures: string[] = []

  for (const raw of values) {
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed || trimmed.length > CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH) continue

    const name = resolvePublicFigureName(trimmed) ?? trimmed
    const key = normalizeSearchPhrase(name)
    if (!key || seen.has(key)) continue

    seen.add(key)
    figures.push(name)
    if (figures.length >= CONTENT_PIECE_PUBLIC_FIGURES_MAX) break
  }

  return figures
}
