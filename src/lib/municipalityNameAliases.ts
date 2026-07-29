import { bahiaMunicipalities } from '@/lib/bahiaTerritories'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

/**
 * THE municipality-name resolution fold (Pass 3 P3-H): variant spellings seen
 * in the wild (TSE open-data NM_MUNICIPIO across 2014/2018/2022, hand-typed
 * CSVs) → canonical `bahiaTerritories` name. This table used to live inside
 * the TSE pipeline, so the supporter import rejected 4 of the 5 spellings the
 * campaign had already reconciled — a latent bug for any CSV digitized from
 * TSE documents.
 *
 * Keys are raw spellings (data); both resolution paths normalize with
 * `normalizeSearchPhrase` (the strictly strongest normalizer: accent-fold,
 * case-fold, punctuation-to-space), so "DIAS D ÁVILA" and "Dias d'Ávila" hit
 * the same entry.
 */
export const MUNICIPALITY_NAME_ALIASES: ReadonlyArray<
  readonly [variant: string, canonical: string]
> = [
  // TSE: CAMACÃ → canonical Camacan
  ['CAMACÃ', 'Camacan'],
  // TSE: "DIAS D ÁVILA" (space, no apostrophe) → Dias d'Ávila
  ['DIAS D ÁVILA', "Dias d'Ávila"],
  // TSE: MUQUÉM DO SÃO FRANCISCO → Muquém de São Francisco
  ['MUQUÉM DO SÃO FRANCISCO', 'Muquém de São Francisco'],
  // TSE: SANTA TEREZINHA → Santa Teresinha
  ['SANTA TEREZINHA', 'Santa Teresinha'],
  // TSE 2018 votacao_candidato_munzona: QUINJINGUE (typo) → canonical Quijingue
  ['QUINJINGUE', 'Quijingue'],
]

const canonicalMunicipalityBySearchValue = new Map(
  bahiaMunicipalities.map((name) => [normalizeSearchPhrase(name), name] as const),
)

for (const [, canonical] of MUNICIPALITY_NAME_ALIASES) {
  if (![...canonicalMunicipalityBySearchValue.values()].includes(canonical)) {
    throw new Error(`Municipality alias points to unknown canonical municipality: ${canonical}`)
  }
}

const aliasBySearchValue = new Map(
  MUNICIPALITY_NAME_ALIASES.map(
    ([variant, canonical]) => [normalizeSearchPhrase(variant), canonical] as const,
  ),
)

/**
 * Resolve any known spelling (canonical or curated variant) to the canonical
 * municipality name. Returns null when unknown — each caller keeps its own
 * error policy (the TSE pipeline throws, the supporter import row-fails).
 */
export const resolveMunicipalityName = (value: string | undefined | null): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const searchValue = normalizeSearchPhrase(trimmed)
  return (
    canonicalMunicipalityBySearchValue.get(searchValue) ??
    aliasBySearchValue.get(searchValue) ??
    null
  )
}
