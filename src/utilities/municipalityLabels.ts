/**
 * Municipality display labels shared by list, detail, dossier and map
 * surfaces. Client-safe: types + string tables only (split out of the former
 * `municipalityUi.ts` in Pass 2 W1).
 */
import { formatElectionNumber, formatVoteSharePercent } from '@/lib/electionFormat'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import type { CampaignUser, Municipality } from '@/payload-types'
import { formatRatioAsPercentLabel } from '@/utilities/goalCoverage'
import type {
  MunicipalityTerritorialClass,
  TerritorialFactor,
} from '@/utilities/municipalityTerritorialClass'

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

/** E10 — operational class of the município (vocabulary of the research report). */
export const territorialClassLabels: Record<MunicipalityTerritorialClass, string> = {
  reduto: 'Reduto',
  expansao: 'Expansão',
  manutencao: 'Manutenção',
  marginal: 'Marginal',
  sem_base: 'Sem base',
}

/**
 * Four fills that survive a 25-row scan, plus one that deliberately doesn't.
 * Reduto reads as achievement (green, like a confirmed estimate); expansão —
 * the class the allocation queue exists to send people to — takes the amber
 * this app already spends on "needs attention" (cold signals, disputed
 * support), never the destructive red the priority badge owns on the same row;
 * manutenção is routine grey; marginal is a hairline pill. `sem_base` is
 * absence of data, not a state: surfaces render it as text, and the list uses
 * the em dash the neighboring "2022" column already uses for "nothing here".
 */
export const territorialClassBadgeVariant = {
  reduto: 'estimate-confirmed',
  expansao: 'estimate-pending',
  manutencao: 'secondary',
  marginal: 'outline',
  sem_base: 'ghost',
} as const

/** Band where the multiple rounds to "1×", which says nothing — name it instead. */
const AT_STANDARD_LQ = { min: 0.95, max: 1.15 } as const

/**
 * The "por quê" behind a class, in the mesa's own phrasing — "aqui a votação
 * está 40% abaixo do padrão estadual" is the sentence the research report says
 * survives the table; "LQ 0,6" is not. The possessive names the candidate
 * ("do candidato"), never "seu", which an assessor reads as their own.
 */
const formatTerritorialClassFactor = (factor: TerritorialFactor): string => {
  switch (factor.id) {
    case 'dominance':
      if (factor.value >= AT_STANDARD_LQ.min && factor.value < AT_STANDARD_LQ.max) {
        return 'no padrão estadual do candidato'
      }
      return factor.value >= 1
        ? `${factor.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o padrão estadual do candidato`
        : `${Math.round((1 - factor.value) * 100)}% abaixo do padrão estadual do candidato`
    case 'ownShare':
      return `${formatVoteSharePercent(factor.value)} da votação estadual do candidato`
    case 'field':
      return `${formatElectionNumber(Math.round(factor.value))} votos do campo sem captura`
    case 'capture':
      return `captura de ${formatRatioAsPercentLabel(factor.value)} do campo`
  }
}

/** Copy for "no TSE series here" — the class label alone would read as a bug. */
export const TERRITORIAL_CLASS_NO_DATA = 'Sem série do TSE para este município.'

/**
 * The two dominant factors as one line. Single source for the rule (list cell,
 * detail card and printed dossier all showed the same `slice(0, 2)` before).
 */
export const formatTerritorialClassWhy = (factors: readonly TerritorialFactor[]): string =>
  factors.slice(0, 2).map(formatTerritorialClassFactor).join(' · ')

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
