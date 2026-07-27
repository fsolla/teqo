import type { AccessibleMunicipality } from '@/lib/municipalityProximity'

type MunicipalityMapSlugEntry = {
  slug: string
  name: string
}

/** IBGE codarea → the accessible catalog units inside it (Salvador has 19). */
export type MunicipalitiesByIbgeCode = Record<string, MunicipalityMapSlugEntry[]>

/**
 * Map key → the slug of the single unit it paints. Since B8 F2 the map draws one
 * polygon per catalog unit — zone municipalities by slug, everything else by IBGE
 * codarea — so this index is 1:1 where `MunicipalitiesByIbgeCode` is 1:N, and the
 * name it used to carry alongside was 435 dead strings in the RSC payload of
 * every visit to Início (the readout takes the name from the feature it painted).
 */
export type MunicipalitiesByMapKey = Record<string, string>

/**
 * What the choropleth paints a unit by: a zone municipality has no code of its
 * own (the whole city shares one), so it is keyed by its immutable catalog slug,
 * which is also the polygon's key in `bahia-municipality-zones.topo.json`.
 */
export const mapKeyForMunicipality = (municipality: {
  kind: 'municipio' | 'zona'
  slug: string
  ibgeCode: string
}): string => (municipality.kind === 'zona' ? municipality.slug : municipality.ibgeCode)

export const buildMunicipalitiesByIbgeCode = (
  municipalities: readonly AccessibleMunicipality[],
): MunicipalitiesByIbgeCode => {
  const byIbge: MunicipalitiesByIbgeCode = {}

  for (const municipality of municipalities) {
    const entries = byIbge[municipality.ibgeCode] ?? []
    entries.push({ slug: municipality.slug, name: municipality.name })
    byIbge[municipality.ibgeCode] = entries
  }

  for (const ibgeCode of Object.keys(byIbge)) {
    byIbge[ibgeCode].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }

  return byIbge
}

export const buildMunicipalitiesByMapKey = (
  municipalities: ReadonlyArray<AccessibleMunicipality & { kind: 'municipio' | 'zona' }>,
): MunicipalitiesByMapKey => {
  const byMapKey: MunicipalitiesByMapKey = {}

  for (const municipality of municipalities) {
    byMapKey[mapKeyForMunicipality(municipality)] = municipality.slug
  }

  return byMapKey
}
