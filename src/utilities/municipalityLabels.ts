/**
 * Municipality display labels shared by list, detail, dossier and map
 * surfaces. Client-safe: types + string tables only (split out of the former
 * `municipalityUi.ts` in Pass 2 W1).
 */
import { formatElectionNumber } from '@/lib/electionInsights'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import type { CampaignUser, Municipality } from '@/payload-types'

export const municipalityKindLabels: Record<Municipality['kind'], string> = {
  municipio: 'Município',
  zona: 'Zona eleitoral',
}

export const municipalityPriorityLabels: Record<NonNullable<Municipality['priority']>, string> = {
  alta: 'Prioritária',
  normal: 'Normal',
}

export type PoliticalTrendStatus = NonNullable<
  NonNullable<Municipality['politicalTrend']>['status']
>

export const politicalTrendLabels: Record<PoliticalTrendStatus, string> = {
  favoravel: 'Favorável',
  neutra: 'Neutra',
  desfavoravel: 'Desfavorável',
}

export const politicalTrendBadgeVariant = {
  favoravel: 'estimate-confirmed',
  neutra: 'secondary',
  desfavoravel: 'destructive',
} as const

export const municipalityListCoverageLabels: Record<'com_assessor' | 'sem_assessor', string> = {
  com_assessor: 'Com assessor',
  sem_assessor: 'Sem assessor',
}

export const formatMunicipalityConcentrationHint = (
  totalUnits: number = municipalityCatalog.length,
): string =>
  `Percentual da votação estadual do candidato neste município — não o % dos válidos locais. Colocação: posição no catálogo de ${formatElectionNumber(totalUnits)} unidades.`

export const getCampaignScopeLabel = (
  role: CampaignUser['role'],
  municipalityCount: number,
): string => {
  if (role === 'advisor') {
    return `${municipalityCount} ${municipalityCount === 1 ? 'município sob sua assessoria' : 'municípios sob sua assessoria'}`
  }
  if (role === 'leader') {
    return `${municipalityCount} ${municipalityCount === 1 ? 'município em que você atua' : 'municípios em que você atua'}`
  }
  return `${municipalityCount} ${municipalityCount === 1 ? 'município' : 'municípios'}`
}

/** Short human description of a municipality's geography, e.g. "Chapada Diamantina · ZE 105". */
export const formatMunicipalityGeographyLabel = (municipality: {
  region: string
  kind: Municipality['kind']
  zoneNumber?: number | null
}): string =>
  municipality.kind === 'zona' && municipality.zoneNumber != null
    ? `${municipality.region} · ZE ${municipality.zoneNumber}`
    : municipality.region
