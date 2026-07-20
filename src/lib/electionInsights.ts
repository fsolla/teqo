import { BASELINE_TICKET_2022 } from '@/lib/electionResults'
import { partySpectrum } from '@/lib/electionPartySpectrum'

export const NO_ELECTION_BASELINE_MESSAGE =
  'Sem baseline TSE (informe território/município)' as const

/** ±10% band between consecutive elections → stable (product default, E2). */
export const VOTE_TREND_STABLE_BAND = 0.1

/** Below this share of aptos → growth opportunity (literature reference, A5). */
export const CONVERSION_OPPORTUNITY_MAX = 0.15

/** At or above this share of aptos → stronghold (literature reference, A5). */
export const CONVERSION_REDUTO_MIN = 0.4

/** Share of federal nominal votes outside the chapa field → flip opportunity (A5 Fase 2). */
export const RIGHT_SHARE_THRESHOLD = 0.25

/** At or above this share of valid federal votes → defesa (literature reference, A5-2). */
export const TERRITORIAL_DEFESA_MIN = 0.35

/** At or above this share → indecisa (between defesa and ataque). */
export const TERRITORIAL_INDECISA_MIN = 0.2

/** At or above this share → ataque; below → perdida. */
export const TERRITORIAL_ATAQUE_MIN = 0.1

export type VoteTrendStatus = 'decline' | 'stable' | 'increase' | 'noBaseline'

export type VoteTrendSeries = {
  y2014: number
  y2018: number
  y2022: number
}

export type VoteTrendResult = {
  status: VoteTrendStatus
  message: string
  ratio: number | null
}

export type GapVs2022Status =
  | 'above'
  | 'below'
  | 'noBaseline'
  | 'noEstimate'
  | 'noCandidateVotes'

export type GapVs2022Result = {
  gap: number | null
  ratio: number | null
  status: GapVs2022Status
  message: string
}

export type ConversionRateBand =
  | 'reduto'
  | 'consolidado'
  | 'oportunidade'
  | 'semEstimativa'
  | 'semBaseline'
  | 'semAptos'

export type ConversionRateInput = {
  aptos: number | null
  abstencoes: number | null
  confirmedVoteEstimate: number | null
}

export type ConversionRateResult = {
  rate: number | null
  rateTurnout: number | null
  band: ConversionRateBand
  message: string
  supportLine: string | null
}

export type ConversionBandDistribution = {
  reduto: number
  consolidado: number
  oportunidade: number
}

export type MobilizationOpportunityStatus =
  | 'opportunity'
  | 'zero'
  | 'semBaseline'
  | 'semAptos'

export type MobilizationOpportunityInput = {
  abstencoes: number | null
  brancos: number | null
  nulos: number | null
  aptos: number | null
}

export type MobilizationOpportunityResult = {
  absolute: number
  relative: number | null
  abstencoes: number
  brancosNulos: number
  status: MobilizationOpportunityStatus
  message: string
  supportLine: string | null
}

export type TerritorialClassificationBand =
  | 'defesa'
  | 'ataque'
  | 'indecisa'
  | 'perdida'
  | 'semBaseline'

export type ComparableTerritorialClass = Exclude<TerritorialClassificationBand, 'semBaseline'>

export type TerritorialClassificationInput = {
  sollaVotes: number
  federalValidVotes: number | null
}

export type TerritorialClassificationResult = {
  percentValid: number | null
  band: TerritorialClassificationBand
  title: string
  priorityLine: string
  supportLine: string | null
}

export type TerritorialClassificationDistribution = {
  defesa: number
  ataque: number
  indecisa: number
  perdida: number
}

/** Minimal baseline shape for Gap vs 2022 (full detail VM is assignable). */
export type GapVs2022Baseline = {
  candidate: { votes: number }
} | null

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const formatElectionNumber = (value: number): string => numberFormatter.format(value)

const formatPercent = (ratio: number): number => Math.round(ratio * 100)

export const formatVoteTrendSeries = (series: VoteTrendSeries): string =>
  `${formatElectionNumber(series.y2014)} (2014) → ${formatElectionNumber(series.y2018)} (2018) → ${formatElectionNumber(series.y2022)} (2022)`

export const formatVoteTrendSeriesCompact = (series: VoteTrendSeries): string =>
  `2014: ${formatElectionNumber(series.y2014)} → 2018: ${formatElectionNumber(series.y2018)} → 2022: ${formatElectionNumber(series.y2022)}`

export type VoteTrendDistribution = Record<VoteTrendStatus, number>

export const emptyVoteTrendDistribution = (): VoteTrendDistribution => ({
  decline: 0,
  stable: 0,
  increase: 0,
  noBaseline: 0,
})

export const comparableTrendCount = (trend: VoteTrendDistribution): number =>
  trend.increase + trend.stable + trend.decline

export const emptyConversionBandDistribution = (): ConversionBandDistribution => ({
  reduto: 0,
  consolidado: 0,
  oportunidade: 0,
})

export const aggregateConversionBand = (
  bands: readonly ConversionRateBand[],
): ConversionBandDistribution => {
  const distribution = emptyConversionBandDistribution()
  for (const band of bands) {
    if (isComparableConversionBand(band)) {
      distribution[band] += 1
    }
  }
  return distribution
}

export const isComparableConversionBand = (
  band: ConversionRateBand,
): band is 'reduto' | 'consolidado' | 'oportunidade' =>
  band === 'reduto' || band === 'consolidado' || band === 'oportunidade'

const emptyTerritorialClassificationDistribution =
  (): TerritorialClassificationDistribution => ({
    defesa: 0,
    ataque: 0,
    indecisa: 0,
    perdida: 0,
  })

export const aggregateTerritorialClass = (
  bands: readonly TerritorialClassificationBand[],
): TerritorialClassificationDistribution => {
  const distribution = emptyTerritorialClassificationDistribution()
  for (const band of bands) {
    if (isComparableTerritorialClass(band)) {
      distribution[band] += 1
    }
  }
  return distribution
}

export const isComparableTerritorialClass = (
  band: TerritorialClassificationBand,
): band is ComparableTerritorialClass =>
  band === 'defesa' || band === 'ataque' || band === 'indecisa' || band === 'perdida'

const TERRITORIAL_CLASS_UI = {
  defesa: {
    label: 'Defesa',
    badgeVariant: 'estimate-confirmed',
    alertVariant: 'default',
    title: 'Território de defesa',
    priorityLine: 'Base sólida — prioridade: manter engajamento',
  },
  indecisa: {
    label: 'Indecisa',
    badgeVariant: 'estimate-pending',
    alertVariant: 'pending',
    title: 'Território indeciso',
    priorityLine: 'Pulverizado — prioridade: consolidar',
  },
  ataque: {
    label: 'Ataque',
    badgeVariant: 'destructive',
    alertVariant: 'destructive',
    title: 'Território de ataque',
    priorityLine: 'Desfavorável relevante — prioridade: virar/reduzir margem',
  },
  perdida: {
    label: 'Perdida',
    badgeVariant: 'secondary',
    alertVariant: 'default',
    title: 'Território perdido',
    priorityLine: 'Baixa base histórica — prioridade: minimizar perda',
  },
} as const satisfies Record<
  ComparableTerritorialClass,
  {
    label: string
    badgeVariant: 'estimate-confirmed' | 'estimate-pending' | 'destructive' | 'secondary'
    alertVariant: 'default' | 'pending' | 'destructive'
    title: string
    priorityLine: string
  }
>

export const territorialClassLabel = (band: TerritorialClassificationBand): string =>
  isComparableTerritorialClass(band) ? TERRITORIAL_CLASS_UI[band].label : 'Sem baseline'

export const territorialClassBadgeVariant = (
  band: TerritorialClassificationBand,
): (typeof TERRITORIAL_CLASS_UI)[ComparableTerritorialClass]['badgeVariant'] =>
  isComparableTerritorialClass(band) ? TERRITORIAL_CLASS_UI[band].badgeVariant : 'secondary'

export const territorialClassAlertVariant = (
  band: TerritorialClassificationBand,
): (typeof TERRITORIAL_CLASS_UI)[ComparableTerritorialClass]['alertVariant'] =>
  isComparableTerritorialClass(band) ? TERRITORIAL_CLASS_UI[band].alertVariant : 'default'

export const conversionRateAlertVariant = (band: ConversionRateBand): 'default' | 'pending' =>
  band === 'oportunidade' ? 'pending' : 'default'

export const isComparableMobilization = (
  status: MobilizationOpportunityStatus,
): status is 'opportunity' => status === 'opportunity'

type TrendPair = { fromVotes: number; toVotes: number; fromYear: number; toYear: number }

const trendPairsByPriority = (series: VoteTrendSeries): TrendPair[] => [
  { fromVotes: series.y2018, toVotes: series.y2022, fromYear: 2018, toYear: 2022 },
  { fromVotes: series.y2014, toVotes: series.y2018, fromYear: 2014, toYear: 2018 },
  { fromVotes: series.y2014, toVotes: series.y2022, fromYear: 2014, toYear: 2022 },
]

/**
 * Classify vote trend from the federal candidate series (2014/2018/2022).
 * Uses the most recent consecutive pair with votes in both years; ±10% → stable.
 */
export const computeVoteTrend = (series: VoteTrendSeries): VoteTrendResult => {
  for (const pair of trendPairsByPriority(series)) {
    if (pair.fromVotes <= 0 || pair.toVotes <= 0) continue

    const ratio = pair.toVotes / pair.fromVotes
    const change = ratio - 1
    const percent = Math.round(Math.abs(change) * 100)

    if (Math.abs(change) <= VOTE_TREND_STABLE_BAND) {
      return {
        status: 'stable',
        ratio,
        message: `Mantém (${pair.fromYear}→${pair.toYear}, variação de ${percent}%)`,
      }
    }

    if (change > VOTE_TREND_STABLE_BAND) {
      return {
        status: 'increase',
        ratio,
        message: `Aumento (${pair.fromYear}→${pair.toYear}, +${percent}%)`,
      }
    }

    return {
      status: 'decline',
      ratio,
      message: `Queda (${pair.fromYear}→${pair.toYear}, −${percent}%)`,
    }
  }

  return {
    status: 'noBaseline',
    ratio: null,
    message: 'Sem série histórica suficiente para tendência',
  }
}

export const aggregateVoteTrend = (seriesList: readonly VoteTrendSeries[]): VoteTrendDistribution => {
  const distribution = emptyVoteTrendDistribution()
  for (const series of seriesList) {
    distribution[computeVoteTrend(series).status] += 1
  }
  return distribution
}

export const voteTrendStatusLabel = (status: VoteTrendStatus): string => {
  switch (status) {
    case 'decline':
      return 'Queda'
    case 'stable':
      return 'Mantém'
    case 'increase':
      return 'Aumento'
    case 'noBaseline':
      return 'Sem baseline'
  }
}

export const voteTrendAlertVariant = (
  status: Exclude<VoteTrendStatus, 'noBaseline'>,
): 'default' | 'pending' => (status === 'decline' ? 'pending' : 'default')

export const voteTrendBadgeVariant = (
  status: VoteTrendStatus,
): 'estimate-confirmed' | 'estimate-pending' | 'secondary' => {
  switch (status) {
    case 'increase':
      return 'estimate-confirmed'
    case 'decline':
      return 'estimate-pending'
    case 'stable':
    case 'noBaseline':
      return 'secondary'
  }
}

/**
 * Compare a confirmed vote estimate against the campaign candidate's 2022
 * votes in the same geography.
 */
export const computeGapVs2022 = (
  baseline: GapVs2022Baseline,
  confirmedVoteEstimate: number | null,
): GapVs2022Result => {
  if (!baseline) {
    return {
      gap: null,
      ratio: null,
      status: 'noBaseline',
      message: NO_ELECTION_BASELINE_MESSAGE,
    }
  }

  if (confirmedVoteEstimate === null) {
    return {
      gap: null,
      ratio: null,
      status: 'noEstimate',
      message: 'Sem estimativa confirmada para comparar',
    }
  }

  const candidateVotes2022 = baseline.candidate.votes
  if (candidateVotes2022 <= 0) {
    return {
      gap: null,
      ratio: null,
      status: 'noCandidateVotes',
      message: `${BASELINE_TICKET_2022.candidate.name} não recebeu votos aqui em 2022 — território novo a abrir`,
    }
  }

  const gap = confirmedVoteEstimate - candidateVotes2022
  const ratio = confirmedVoteEstimate / candidateVotes2022

  if (gap < 0) {
    return {
      gap,
      ratio,
      status: 'below',
      message: `Faltam ${formatElectionNumber(Math.abs(gap))} votos para o patamar de 2022`,
    }
  }

  const percentAbove = Math.round((ratio - 1) * 100)
  return {
    gap,
    ratio,
    status: 'above',
    message: `Já superamos 2022 em ${percentAbove}%`,
  }
}

/**
 * Compare a confirmed vote estimate against the electorate size (aptos) in the
 * same geography. Optional turnout line uses aptos − abstencoes.
 */
export const computeConversionRate = ({
  aptos,
  abstencoes,
  confirmedVoteEstimate,
}: ConversionRateInput): ConversionRateResult => {
  if (aptos === null) {
    return {
      rate: null,
      rateTurnout: null,
      band: 'semBaseline',
      message: NO_ELECTION_BASELINE_MESSAGE,
      supportLine: null,
    }
  }

  if (confirmedVoteEstimate === null) {
    return {
      rate: null,
      rateTurnout: null,
      band: 'semEstimativa',
      message: 'Sem estimativa confirmada para calcular a conversão',
      supportLine: null,
    }
  }

  if (aptos <= 0) {
    return {
      rate: null,
      rateTurnout: null,
      band: 'semAptos',
      message: 'Sem eleitores aptos no baseline para esta geografia',
      supportLine: null,
    }
  }

  const rate = confirmedVoteEstimate / aptos
  const percent = Math.round(rate * 100)

  let band: ConversionRateBand
  if (rate < CONVERSION_OPPORTUNITY_MAX) {
    band = 'oportunidade'
  } else if (rate >= CONVERSION_REDUTO_MIN) {
    band = 'reduto'
  } else {
    band = 'consolidado'
  }

  const abst = abstencoes ?? 0
  const comparecimento = aptos - abst
  const rateTurnout = comparecimento > 0 ? confirmedVoteEstimate / comparecimento : null

  let supportLine = `${formatElectionNumber(confirmedVoteEstimate)} votos / ${formatElectionNumber(aptos)} eleitores aptos`
  if (rateTurnout !== null) {
    supportLine += ` · ${Math.round(rateTurnout * 100)}% do comparecimento`
  }

  return {
    rate,
    rateTurnout,
    band,
    message: `Taxa de conversão: ${percent}% do eleitorado apto`,
    supportLine,
  }
}

/**
 * Sum abstentions + blank + null votes as mobilization potential (excludes anulados).
 */
export const computeMobilizationOpportunity = ({
  abstencoes,
  brancos,
  nulos,
  aptos,
}: MobilizationOpportunityInput): MobilizationOpportunityResult => {
  if (aptos === null) {
    return {
      absolute: 0,
      relative: null,
      abstencoes: 0,
      brancosNulos: 0,
      status: 'semBaseline',
      message: NO_ELECTION_BASELINE_MESSAGE,
      supportLine: null,
    }
  }

  if (aptos <= 0) {
    return {
      absolute: 0,
      relative: null,
      abstencoes: 0,
      brancosNulos: 0,
      status: 'semAptos',
      message: 'Sem eleitores aptos no baseline para esta geografia',
      supportLine: null,
    }
  }

  const abstencoesTotal = abstencoes ?? 0
  const brancosNulos = (brancos ?? 0) + (nulos ?? 0)
  const absolute = abstencoesTotal + brancosNulos
  const relative = absolute / aptos

  if (absolute <= 0) {
    return {
      absolute: 0,
      relative: 0,
      abstencoes: abstencoesTotal,
      brancosNulos,
      status: 'zero',
      message: 'Sem potencial de mobilização no baseline 2022',
      supportLine: 'Sem brancos, nulos ou abstenções no baseline 2022',
    }
  }

  return {
    absolute,
    relative,
    abstencoes: abstencoesTotal,
    brancosNulos,
    status: 'opportunity',
    message: 'Oportunidade de mobilização',
    supportLine: `${formatElectionNumber(brancosNulos)} brancos/nulos + ${formatElectionNumber(abstencoesTotal)} abstenções = ${formatElectionNumber(absolute)} votos possíveis · ${formatPercent(relative)}% do eleitorado apto`,
  }
}

export type TicketLeverageStatus =
  | 'comparable'
  | 'noEstimate'
  | 'noBaseline'
  | 'noTicketVotes'

export type TicketLeverageInput = {
  confirmedVoteEstimate: number | null
  presidentVotes: number | null
  governorVotes: number | null
}

export type TicketLeverageResult = {
  headlinePercent: number | null
  /** Stronger majoritarian base used for the headline ratio (comparable only). */
  ticketVotes: number | null
  status: TicketLeverageStatus
  message: string
  supportLine: string | null
}

export type MajoritarianWinner = {
  name: string
  party: string
  votes: number
} | null

export type TicketFlipTrigger = 'winner' | 'share' | 'both'

export type MajoritarianAlignment = 'president' | 'governor' | 'both'

export type TicketFlipStatus =
  | 'opportunity'
  | 'noOpportunity'
  | 'ambiguous'
  | 'unknownSpectrum'
  | 'incomplete'

export type TicketFlipOpportunityInput = {
  winnerPresident: MajoritarianWinner
  winnerGovernor: MajoritarianWinner
  winnerFederal: MajoritarianWinner
  federalVotesByParty: Readonly<Record<string, number>>
}

export type TicketFlipOpportunityResult = {
  status: TicketFlipStatus
  trigger: TicketFlipTrigger | null
  majoritarianAlignment: MajoritarianAlignment | null
  rightShare: number | null
  rightVotes: number
  totalFederalVotes: number
  message: string
  supportLine: string | null
}

export type TicketLeverageOverviewAggregate = {
  weightedPercent: number
  unconvertedCount: number
}

export type TicketFlipOverviewAggregate = {
  count: number
  bothAlignedCount: number
}

export type MobilizationOverviewAggregate = {
  absoluteTotal: number
  relativePercent: number
  brancosNulosTotal: number
  abstencoesTotal: number
}

/** User-facing label for the configured majoritarian ticket base (cycle-specific names). */
export const formatMajoritarianTicketBaseLabel = (): string =>
  `${BASELINE_TICKET_2022.president.name}/${BASELINE_TICKET_2022.governor.name.split(' ')[0]}`

const MAJORITARIAN_ALIGNMENT_MESSAGE_PREFIX: Record<MajoritarianAlignment, string> = {
  both: 'Majoritários alinhados. ',
  president: 'Presidente alinhado. ',
  governor: 'Governador alinhado. ',
}

const ticketLeverageUnavailable = (
  status: Exclude<TicketLeverageStatus, 'comparable'>,
  message: string,
): TicketLeverageResult => ({
  headlinePercent: null,
  ticketVotes: null,
  status,
  message,
  supportLine: null,
})

/**
 * Fase 1 — how much of the president/governor majoritarian base the confirmed estimate captures.
 */
export const computeTicketLeverage = ({
  confirmedVoteEstimate,
  presidentVotes,
  governorVotes,
}: TicketLeverageInput): TicketLeverageResult => {
  if (presidentVotes === null && governorVotes === null) {
    return ticketLeverageUnavailable('noBaseline', NO_ELECTION_BASELINE_MESSAGE)
  }

  if (confirmedVoteEstimate === null) {
    return ticketLeverageUnavailable(
      'noEstimate',
      'Sem estimativa confirmada para calcular a alavancagem',
    )
  }

  const presidentVoteTotal = presidentVotes ?? 0
  const governorVoteTotal = governorVotes ?? 0
  const ticketVotes = Math.max(presidentVoteTotal, governorVoteTotal)

  if (ticketVotes <= 0) {
    return ticketLeverageUnavailable(
      'noTicketVotes',
      'Sem votos da chapa majoritária nesta geografia em 2022',
    )
  }

  const headlineRatio = confirmedVoteEstimate / ticketVotes
  const headlinePercent = formatPercent(headlineRatio)

  const unconverted = headlineRatio < 1
  const supportParts: string[] = []
  if (presidentVoteTotal > 0) {
    supportParts.push(
      `${BASELINE_TICKET_2022.president.name}: ${formatPercent(confirmedVoteEstimate / presidentVoteTotal)}% (${formatElectionNumber(confirmedVoteEstimate)} / ${formatElectionNumber(presidentVoteTotal)})`,
    )
  }
  if (governorVoteTotal > 0) {
    supportParts.push(
      `${BASELINE_TICKET_2022.governor.name}: ${formatPercent(confirmedVoteEstimate / governorVoteTotal)}% (${formatElectionNumber(confirmedVoteEstimate)} / ${formatElectionNumber(governorVoteTotal)})`,
    )
  }

  const ticketBaseLabel = formatMajoritarianTicketBaseLabel()

  return {
    headlinePercent,
    ticketVotes,
    status: 'comparable',
    message: `Alavancagem da chapa: ${headlinePercent}%`,
    supportLine: unconverted
      ? `Da base ${ticketBaseLabel} ainda não convertida${supportParts.length ? ` · ${supportParts.join(' · ')}` : ''}`
      : supportParts.join(' · ') || null,
  }
}

export const isComparableTicketLeverage = (status: TicketLeverageStatus): status is 'comparable' =>
  status === 'comparable'

const sumRightFederalVotes = (
  federalVotesByParty: Readonly<Record<string, number>>,
): { rightVotes: number; totalVotes: number; hasUnknownParty: boolean } => {
  let rightVotes = 0
  let totalVotes = 0
  let hasUnknownParty = false

  for (const [party, votes] of Object.entries(federalVotesByParty)) {
    if (votes <= 0) continue
    totalVotes += votes
    const spectrum = partySpectrum(party)
    if (spectrum === null) {
      hasUnknownParty = true
      continue
    }
    if (spectrum === 'direita') rightVotes += votes
  }

  return { rightVotes, totalVotes, hasUnknownParty }
}

const resolveMajoritarianAlignment = (
  winnerPresident: MajoritarianWinner,
  winnerGovernor: MajoritarianWinner,
): MajoritarianAlignment | null => {
  const presidentLeft = winnerPresident ? partySpectrum(winnerPresident.party) === 'esquerda' : false
  const governorLeft = winnerGovernor ? partySpectrum(winnerGovernor.party) === 'esquerda' : false

  if (presidentLeft && governorLeft) return 'both'
  if (presidentLeft) return 'president'
  if (governorLeft) return 'governor'
  return null
}

/**
 * Fase 2 — majoritarian left alignment + federal proportional still outside the chapa field.
 */
export const computeTicketFlipOpportunity = ({
  winnerPresident,
  winnerGovernor,
  winnerFederal,
  federalVotesByParty,
}: TicketFlipOpportunityInput): TicketFlipOpportunityResult => {
  const majoritarianAlignment = resolveMajoritarianAlignment(winnerPresident, winnerGovernor)

  if (!majoritarianAlignment) {
    return {
      status: 'incomplete',
      trigger: null,
      majoritarianAlignment: null,
      rightShare: null,
      rightVotes: 0,
      totalFederalVotes: 0,
      message: 'Sem alinhamento majoritário de esquerda nesta geografia',
      supportLine: null,
    }
  }

  const { rightVotes, totalVotes, hasUnknownParty } = sumRightFederalVotes(federalVotesByParty)

  if (totalVotes <= 0) {
    return {
      status: 'incomplete',
      trigger: null,
      majoritarianAlignment,
      rightShare: null,
      rightVotes: 0,
      totalFederalVotes: 0,
      message: 'Sem votos nominais federais nesta geografia',
      supportLine: null,
    }
  }

  if (hasUnknownParty) {
    return {
      status: 'unknownSpectrum',
      trigger: null,
      majoritarianAlignment,
      rightShare: rightVotes / totalVotes,
      rightVotes,
      totalFederalVotes: totalVotes,
      message: 'Espectro partidário incompleto para avaliar oportunidade',
      supportLine: null,
    }
  }

  const rightShare = rightVotes / totalVotes
  const triggerWinner =
    winnerFederal !== null && partySpectrum(winnerFederal.party) === 'direita'
  const triggerShare = rightShare >= RIGHT_SHARE_THRESHOLD

  if (!triggerWinner && !triggerShare) {
    return {
      status: 'noOpportunity',
      trigger: null,
      majoritarianAlignment,
      rightShare,
      rightVotes,
      totalFederalVotes: totalVotes,
      message: 'Sem oportunidade de completar a chapa neste território',
      supportLine: null,
    }
  }

  const trigger: TicketFlipTrigger =
    triggerWinner && triggerShare ? 'both' : triggerWinner ? 'winner' : 'share'

  const prefix = MAJORITARIAN_ALIGNMENT_MESSAGE_PREFIX[majoritarianAlignment]
  const opportunityLead = 'Oportunidade de completar a chapa'
  const shareLine = `${formatPercent(rightShare)}% do proporcional federal ficou fora do campo da chapa.`
  let message: string
  let supportLine: string | null = null

  if ((trigger === 'winner' || trigger === 'both') && winnerFederal) {
    message = `${prefix}${opportunityLead} — o mais votado a dep. federal ficou fora do campo (${winnerFederal.name}, ${winnerFederal.party}).`
    if (trigger === 'both') supportLine = shareLine
  } else {
    message = `${prefix}${opportunityLead} — ${shareLine}`
  }

  return {
    status: 'opportunity',
    trigger,
    majoritarianAlignment,
    rightShare,
    rightVotes,
    totalFederalVotes: totalVotes,
    message,
    supportLine,
  }
}

export const aggregateTicketLeverageOverview = (
  rows: readonly { estimate: number; ticketVotes: number }[],
): TicketLeverageOverviewAggregate | null => {
  let estimateSum = 0
  let ticketVotesSum = 0
  let unconvertedCount = 0

  for (const { estimate, ticketVotes } of rows) {
    if (ticketVotes <= 0) continue
    estimateSum += estimate
    ticketVotesSum += ticketVotes
    if (estimate < ticketVotes) unconvertedCount += 1
  }

  if (ticketVotesSum <= 0) return null

  return {
    weightedPercent: Math.round((estimateSum / ticketVotesSum) * 100),
    unconvertedCount,
  }
}

export const aggregateTicketFlipOverview = (
  results: readonly TicketFlipOpportunityResult[],
): TicketFlipOverviewAggregate => {
  let count = 0
  let bothAlignedCount = 0

  for (const result of results) {
    if (result.status !== 'opportunity') continue
    count += 1
    if (result.majoritarianAlignment === 'both') bothAlignedCount += 1
  }

  return { count, bothAlignedCount }
}

export const aggregateMobilizationOverview = (
  input: MobilizationOpportunityInput,
): MobilizationOverviewAggregate | null => {
  const result = computeMobilizationOpportunity(input)
  if (!isComparableMobilization(result.status)) return null

  return {
    absoluteTotal: result.absolute,
    relativePercent: formatPercent(result.relative ?? 0),
    brancosNulosTotal: result.brancosNulos,
    abstencoesTotal: result.abstencoes,
  }
}

export const ticketLeverageAlertVariant = (
  leverage: TicketLeverageResult,
): 'default' | 'pending' =>
  isComparableTicketLeverage(leverage.status) && (leverage.headlinePercent ?? 0) < 100
    ? 'pending'
    : 'default'

export const computeTerritorialClass = ({
  sollaVotes,
  federalValidVotes,
}: TerritorialClassificationInput): TerritorialClassificationResult => {
  if (federalValidVotes === null || federalValidVotes <= 0) {
    return {
      percentValid: null,
      band: 'semBaseline',
      title: 'Classificação territorial',
      priorityLine:
        federalValidVotes === null
          ? NO_ELECTION_BASELINE_MESSAGE
          : 'Sem votos válidos no baseline para esta geografia',
      supportLine: null,
    }
  }

  const percentValid = sollaVotes / federalValidVotes
  const percent = Math.round(percentValid * 100)

  let band: ComparableTerritorialClass
  if (percentValid >= TERRITORIAL_DEFESA_MIN) {
    band = 'defesa'
  } else if (percentValid >= TERRITORIAL_INDECISA_MIN) {
    band = 'indecisa'
  } else if (percentValid >= TERRITORIAL_ATAQUE_MIN) {
    band = 'ataque'
  } else {
    band = 'perdida'
  }

  const { title, priorityLine } = TERRITORIAL_CLASS_UI[band]

  return {
    percentValid,
    band,
    title,
    priorityLine,
    supportLine: `${percent}% dos votos válidos federais em 2022 (${formatElectionNumber(sollaVotes)} / ${formatElectionNumber(federalValidVotes)})`,
  }
}
