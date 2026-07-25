type MunicipalityMapSlugEntry = {
  slug: string
  name: string
}

export type MunicipalitiesByIbgeCode = Record<string, MunicipalityMapSlugEntry[]>

export type MunicipalityMapNavigation =
  | { kind: 'none' }
  | { kind: 'navigate'; slug: string }
  | { kind: 'zones' }

type MunicipalityForIbgeIndex = {
  slug: string
  name: string
  ibgeCode: string
}

export const buildMunicipalitiesByIbgeCode = (
  municipalities: MunicipalityForIbgeIndex[],
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

export const resolveMunicipalityMapNavigation = (
  ibgeCode: string,
  municipalitiesByIbgeCode: MunicipalitiesByIbgeCode,
): MunicipalityMapNavigation => {
  const entries = municipalitiesByIbgeCode[ibgeCode]
  if (!entries || entries.length === 0) return { kind: 'none' }
  if (entries.length === 1) return { kind: 'navigate', slug: entries[0].slug }
  return { kind: 'zones' }
}
