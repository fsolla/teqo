export type PlazaMapSlugEntry = {
  slug: string
  name: string
}

export type PlazasByIbgeCode = Record<string, PlazaMapSlugEntry[]>

export type PlazaMapNavigation =
  | { kind: 'none' }
  | { kind: 'navigate'; slug: string }
  | { kind: 'zones' }

type PlazaForIbgeIndex = {
  slug: string
  name: string
  ibgeCode: string
}

export const buildPlazasByIbgeCode = (plazas: PlazaForIbgeIndex[]): PlazasByIbgeCode => {
  const byIbge: PlazasByIbgeCode = {}

  for (const plaza of plazas) {
    const entries = byIbge[plaza.ibgeCode] ?? []
    entries.push({ slug: plaza.slug, name: plaza.name })
    byIbge[plaza.ibgeCode] = entries
  }

  for (const ibgeCode of Object.keys(byIbge)) {
    byIbge[ibgeCode].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }

  return byIbge
}

export const resolvePlazaMapNavigation = (
  ibgeCode: string,
  plazasByIbgeCode: PlazasByIbgeCode,
): PlazaMapNavigation => {
  const entries = plazasByIbgeCode[ibgeCode]
  if (!entries || entries.length === 0) return { kind: 'none' }
  if (entries.length === 1) return { kind: 'navigate', slug: entries[0].slug }
  return { kind: 'zones' }
}
