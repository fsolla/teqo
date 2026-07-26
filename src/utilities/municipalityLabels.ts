/**
 * Municipality display labels shared by list, detail, dossier and map
 * surfaces. Client-safe: string tables plus the pure formatters that turn a
 * derived value into its pt-BR copy — no Payload, no DB, and no value import
 * from a `server-only` module (split out of the former `municipalityUi.ts` in
 * Pass 2 W1).
 */
import { campaignConceptOneLiner } from '@/lib/campaignIntelligenceConcepts'
import {
  formatElectionNumber,
  formatVoteSharePercent,
  oneDecimalFormatter,
} from '@/lib/electionFormat'
import { municipalityCatalog } from '@/lib/municipalityCatalog'
import { AT_STANDARD_LQ } from '@/lib/territorialClassAnchors'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, voteEstimateScenarioLabels } from '@/lib/voteEstimate'
import type { CampaignUser, Municipality } from '@/payload-types'
import { formatRatioAsPercentLabel } from '@/utilities/goalCoverage'
import { MUNICIPALITY_COLD_SIGNAL_DAYS } from '@/utilities/municipalitySignal'
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
 * manutenção is routine grey; marginal is a hairline pill.
 *
 * `sem_base` is absence of data, not a state, so it gets the flattest fill and
 * reads differently by surface: the list renders the em dash the neighboring
 * "2022" column already uses for "nothing here", while the detail card and the
 * dossier keep the pill because there the class sits in a labeled field ("Classe
 * …") where a dash would read as a rendering failure rather than as missing data.
 */
export const territorialClassBadgeVariant = {
  reduto: 'estimate-confirmed',
  expansao: 'estimate-pending',
  manutencao: 'secondary',
  marginal: 'outline',
  sem_base: 'ghost',
} as const

/**
 * The same ladder as fills for the map's proportional symbols (B13). Literal
 * hex rather than the CSS tokens above because Leaflet writes the SVG `fill`
 * ATTRIBUTE, where `var(--estimate-confirmed)` does not resolve — these mirror
 * the token values in `styles.css` (see `DESIGN.md` § Status Badge) and must
 * be changed together with them.
 *
 * Saturated over a basemap: the badge tints are tuned for a white row and
 * would disappear on top of tiles, so each step is the readable sibling of
 * its token, not the token itself.
 */
export const territorialClassMapFill: Record<MunicipalityTerritorialClass, string> = {
  reduto: '#16a34a',
  expansao: '#d97706',
  manutencao: '#78716c',
  marginal: '#a8a29e',
  sem_base: '#d6d3d1',
}

/**
 * The "por quê" behind a class, in the mesa's own phrasing — "aqui a votação
 * está 40% abaixo do padrão estadual" is the sentence the research report says
 * survives the table; "LQ 0,6" is not. The possessive names the candidate
 * ("do candidato"), never "seu", which an assessor reads as their own.
 */
export const formatDominanceAgainstOwnStandard = (lq: number): string => {
  if (lq >= AT_STANDARD_LQ.min && lq < AT_STANDARD_LQ.max) {
    return 'no padrão estadual do candidato'
  }
  return lq >= 1
    ? `${oneDecimalFormatter.format(lq)}× o padrão estadual do candidato`
    : `${formatRatioAsPercentLabel(1 - lq)} abaixo do padrão estadual do candidato`
}

const formatTerritorialClassFactor = (factor: TerritorialFactor): string => {
  switch (factor.id) {
    case 'dominance':
      return formatDominanceAgainstOwnStandard(factor.value)
    case 'ownShare':
      return `${formatVoteSharePercent(factor.value)} da votação estadual do candidato`
    case 'field':
      return `${formatElectionNumber(Math.round(factor.value))} votos do campo sem captura`
    case 'capture':
      return `captura de ${formatRatioAsPercentLabel(factor.value)} do campo`
  }
}

/** Copy for "no TSE series here" — the class label alone would read as a bug. */
const TERRITORIAL_CLASS_NO_DATA = 'Sem série do TSE para este município.'

/**
 * The two dominant factors as one line — single source for the rule, which the
 * list cell, the detail card and the printed dossier each used to carry. Falls
 * back to the "no series" copy so a caller can never render a blank line where
 * the "por quê" belongs.
 */
export const formatTerritorialClassWhy = (factors: readonly TerritorialFactor[]): string =>
  factors.length === 0
    ? TERRITORIAL_CLASS_NO_DATA
    : factors.slice(0, 2).map(formatTerritorialClassFactor).join(' · ')

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

/**
 * The 11 real column ids in `/campanha/municipios` — 10 staff columns plus
 * `lastUpdateAt`, which only the non-staff (leader) view renders. Closed union
 * so `municipalityColumnDescriptions` below can't silently drop a column.
 */
export type MunicipalityListColumnId =
  | 'name'
  | 'region'
  | 'kind'
  | 'votos'
  | 'classe'
  | 'advisors'
  | 'trend'
  | 'expectedVotes'
  | 'lastSignal'
  | 'goalCoverage'
  | 'lastUpdateAt'

/**
 * E10 "Classe" header hint — kept verbatim rather than swapped for the
 * terser E18 `oneLiner` (`classe-territorial`): a 5-way classification needs
 * more than one sentence, and the shorter concept text would be a clarity
 * downgrade for this specific column.
 */
const CLASS_COLUMN_DESCRIPTION =
  'Leitura relativa de 2022: o desempenho aqui contra o padrão estadual do próprio candidato. Reduto (bem acima do padrão), Expansão (abaixo, mas com campo a ocupar), Manutenção (no padrão), Marginal (abaixo, com pouco campo) e — sem série do TSE. É sugestão de leitura, não decisão: cada classe traz o porquê ao passar o mouse ou tocar nela.'

/**
 * B22 — single source of copy for every `/campanha/municipios` column header
 * tooltip. E18-documented metrics quote their canonical `oneLiner` instead of
 * a second, driftable sentence; the rest is new short pt-BR copy. Computed at
 * module scope: every entry here only ever depended on static constants, not
 * on props, so there is nothing to recompute per render.
 */
export const municipalityColumnDescriptions: Record<MunicipalityListColumnId, string> = {
  name: 'Nome do município e prioridade da campanha.',
  region: 'Território de Identidade (Bahia) a que o município pertence.',
  kind: 'Município inteiro ou zona eleitoral de Salvador (ZE 1–19).',
  votos: formatMunicipalityConcentrationHint(),
  classe: CLASS_COLUMN_DESCRIPTION,
  advisors: 'Assessor(es) responsável(is) pelo município — o coordenador atribui clicando aqui.',
  trend: 'Tendência política percebida pela equipe: favorável, neutra ou desfavorável.',
  expectedVotes: campaignConceptOneLiner('meta'),
  lastSignal: `Última atualização da equipe ou declaração de liderança, o que for mais recente. Fica destacado a partir de ${MUNICIPALITY_COLD_SIGNAL_DAYS} dias sem registro.`,
  // The scenario picker above the table is client state, so the server can
  // only sort by one scenario — named here so the ordering never looks
  // arbitrary next to whatever scenario is currently selected.
  goalCoverage: `${campaignConceptOneLiner('cobertura-da-meta')} Ordena pelo que falta para a meta (meta − comprometido) no cenário ${voteEstimateScenarioLabels[DEFAULT_VOTE_ESTIMATE_SCENARIO]}, independente do cenário selecionado acima.`,
  lastUpdateAt: 'Data do último registro da equipe ou de liderança neste município.',
}
