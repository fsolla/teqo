/**
 * C244 — the initial curated catalog of public figures for the album's
 * "Pessoa pública" facet: the six named figures of the owner's decision
 * (2026-10-01) plus the S30 state-deputy roster already in the campaign
 * catalog. Names are the public display labels; the slug is `slugify(name)`
 * and is the `?pessoa=<slug>` URL value, so it must stay stable. The roster
 * is shared with `src/lib/publicFigureCatalog.ts` (the ficha picker) — same
 * source (`stateDeputyCatalog`), different purpose: here it is the face
 * catalog, there the text "quem aparece na peça".
 *
 * The seed only creates the identity rows (no references): a figure only shows
 * up in the facet after a reference is enrolled with `pnpm faces:enroll-figure`
 * and recognized in an approved photo. Júlio Pinheiro is both a named figure
 * and a roster entry — the dedupe by slug keeps the curated spelling.
 *
 * Pure planning data: no I/O, unit-testable.
 */
import { slugify } from '../../src/lib/slug.ts'
import { stateDeputyCatalog } from '../../src/lib/stateDeputyCatalog.ts'

/** The named figures of the owner's catalog decision (2026-10-01). */
export const FACE_FIGURE_NAMED_ENTRIES = Object.freeze([
  { name: 'Jorge Solla', fullName: 'Jorge Solla' },
  { name: 'Lula', fullName: 'Luiz Inácio Lula da Silva' },
  { name: 'Jerônimo', fullName: 'Jerônimo Rodrigues' },
  { name: 'Geraldinho', fullName: 'Geraldo Júnior' },
  { name: 'Wagner', fullName: 'Jaques Wagner' },
  { name: 'Júlio Pinheiro' },
])

/**
 * The seed rows, deduped by slug: `{ name, slug, fullName? }`, named figures
 * first so a roster duplicate never overrides the curated spelling.
 */
export const faceFigureCatalogSeed = () => {
  const entries = []
  const seen = new Set()

  const push = (name, fullName) => {
    const slug = slugify(name)
    if (!slug || seen.has(slug)) return
    seen.add(slug)
    entries.push(fullName ? { name, slug, fullName } : { name, slug })
  }

  for (const named of FACE_FIGURE_NAMED_ENTRIES) push(named.name, named.fullName)
  for (const deputy of stateDeputyCatalog) push(deputy.name)

  return entries
}
