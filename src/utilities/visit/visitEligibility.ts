import { formatBahiaCivilDate } from '@/lib/campaignTime'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import { CALENDAR_PHASE_ANCHORS, type CalendarPhase } from '@/lib/visitPlannerAnchors'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'

/**
 * E13 "planejador de presença" — is this município worth a day of the
 * candidate's agenda? The answer is a **checklist of five conditions**, never a
 * score: the research report (§6.7) is explicit that a visit is worth what the
 * local network converts from it, and §6.4 documents that a composite 0–100
 * buys false confidence. The discipline of requiring all five IS the value, so
 * the caller renders ✓/— with the reason next to each one and no total.
 *
 * Pure over an explicit input (same shape discipline as `TerritorialClassInput`)
 * so the município detail card and the tour composer feed one evaluator from
 * different reads instead of drifting into two definitions of "elegível".
 */
export const VISIT_CONDITIONS = ['volume', 'headroom', 'rede', 'janela', 'encaixe'] as const

export type VisitConditionId = (typeof VISIT_CONDITIONS)[number]

export type VisitCondition = {
  id: VisitConditionId
  met: boolean
  /** Always rendered as visible text — never a `title` attribute (E10 precedent). */
  detail: string
}

/**
 * The contraindication is an ADVISORY, never a block: "a geografia serve à
 * política" (T5), so the coordination overrides it whenever a political reason
 * outweighs the numbers. `allocationDecision` write paths exist since E14
 * (level movements) and E11 (`resolveSuggestion` — aceita/descarta/adiada);
 * wiring THIS advisory's override into the registry is a small follow-up on
 * that action, and until then it lives in the head of whoever ignored the
 * warning.
 */
export const VISIT_CONTRAINDICATIONS = ['perdida', 'sem_rede', 'no_teto'] as const

export type VisitContraindicationId = (typeof VISIT_CONTRAINDICATIONS)[number]

type VisitContraindication = {
  id: VisitContraindicationId
  reason: string
  /** The intermediate offer to make instead of a visit ("mande o coordenador"). */
  counterOffer: string
}

export type VisitEligibility = {
  conditions: VisitCondition[]
  metCount: number
  contraindication: VisitContraindication | null
}

export type VisitEligibilityInput = {
  /** E8 projected 2026 valid votes — the size of the room. */
  projectedValidVotes: number
  /** Catalog median of the above: "grande" is relative, so no vote count ages. */
  projectedValidVotesCut: number
  /** E8 goal coverage deficit (`central`): positive means the goal is uncovered. */
  coverageDeficit: number
  /** Projected field ceiling minus his own vote, floored at 0 (E8/E10). */
  uncapturedFieldVotes: number
  /** Catalog median of the above — same relative-cut discipline. */
  uncapturedFieldVotesCut: number
  advisorCount: number
  leadershipCount: number
  pledgeCount: number
  /** Dobradinhas linked to the município (`stateDeputies`, seeded by E4R). */
  linkedStateDeputyCount: number
  politicalTrend: PoliticalTrendStatusValue | null
  territorialClass: MunicipalityTerritorialClass
  /**
   * Other municípios of the SAME identity territory, inside the reader's
   * access scope, that already have somewhere to stop (a liderança or a
   * pledge). "Encaixe em giro" means exactly this in v1 — there is no
   * adjacency graph at runtime, and building one is the route-optimizer rabbit
   * hole the plan forbids.
   */
  territoryStopPeerCount: number
}

const votes = (value: number): string => formatElectionNumber(Math.round(value))

const volumeCondition = (input: VisitEligibilityInput): VisitCondition => {
  const met = input.projectedValidVotes >= input.projectedValidVotesCut
  return {
    id: 'volume',
    met,
    detail: `${votes(input.projectedValidVotes)} votos válidos projetados, ${met ? 'acima' : 'abaixo'} da mediana do estado (${votes(input.projectedValidVotesCut)})`,
  }
}

const headroomCondition = (input: VisitEligibilityInput): VisitCondition => {
  const goalUncovered = input.coverageDeficit > 0
  const fieldLeft = input.uncapturedFieldVotes >= input.uncapturedFieldVotesCut
  if (goalUncovered) {
    return {
      id: 'headroom',
      met: true,
      detail: `Faltam ${votes(input.coverageDeficit)} votos para a meta`,
    }
  }
  if (fieldLeft) {
    return {
      id: 'headroom',
      met: true,
      detail: `Meta coberta, mas ainda há ${votes(input.uncapturedFieldVotes)} votos de campo não capturados`,
    }
  }
  return {
    id: 'headroom',
    met: false,
    detail: `Meta coberta e pouco campo a capturar (${votes(input.uncapturedFieldVotes)} votos, abaixo da mediana)`,
  }
}

const redeCondition = (input: VisitEligibilityInput): VisitCondition => {
  const hasAdvisor = input.advisorCount >= 1
  const hasField = input.leadershipCount >= 1 || input.pledgeCount >= 1
  const fieldLabel =
    input.leadershipCount >= 1
      ? `${input.leadershipCount} liderança${input.leadershipCount > 1 ? 's' : ''}`
      : `${input.pledgeCount} compromisso${input.pledgeCount > 1 ? 's' : ''}`

  if (hasAdvisor && hasField) {
    return { id: 'rede', met: true, detail: `Assessor responsável e ${fieldLabel} para receber` }
  }
  if (!hasAdvisor && !hasField) {
    return {
      id: 'rede',
      met: false,
      detail: 'Sem assessor responsável e sem rede local registrada',
    }
  }
  return {
    id: 'rede',
    met: false,
    detail: hasAdvisor
      ? 'Assessor responsável, mas nenhuma liderança ou compromisso para receber'
      : `${fieldLabel} no município, mas sem assessor responsável`,
  }
}

const janelaCondition = (input: VisitEligibilityInput): VisitCondition => {
  if (input.linkedStateDeputyCount >= 1) {
    const count = input.linkedStateDeputyCount
    return {
      id: 'janela',
      met: true,
      detail: `${count} dobradinha${count > 1 ? 's' : ''} vinculada${count > 1 ? 's' : ''} para casar a agenda`,
    }
  }
  if (input.politicalTrend === 'favoravel' || input.politicalTrend === 'neutra') {
    return {
      id: 'janela',
      met: true,
      detail:
        input.politicalTrend === 'favoravel'
          ? 'Tendência política favorável'
          : 'Tendência política neutra, sem impedimento registrado',
    }
  }
  return {
    id: 'janela',
    met: false,
    detail:
      input.politicalTrend === 'desfavoravel'
        ? 'Tendência política desfavorável e nenhuma dobradinha vinculada'
        : 'Tendência política não registrada e nenhuma dobradinha vinculada',
  }
}

const encaixeCondition = (input: VisitEligibilityInput): VisitCondition => {
  const count = input.territoryStopPeerCount
  const met = count >= 1
  return {
    id: 'encaixe',
    met,
    detail: met
      ? `${count} outro${count > 1 ? 's' : ''} município${count > 1 ? 's' : ''} do mesmo território com parada possível`
      : 'Nenhum outro município do mesmo território tem liderança ou compromisso — a viagem renderia uma parada só',
  }
}

const resolveContraindication = (
  input: VisitEligibilityInput,
  conditions: ReadonlyArray<VisitCondition>,
): VisitContraindication | null => {
  const hasNetwork = input.leadershipCount >= 1 || input.pledgeCount >= 1
  const weakClass = input.territorialClass === 'sem_base' || input.territorialClass === 'marginal'

  // Reading order of the mesa: the hardest "não vá" first (nothing to win AND
  // nobody to convert), then the fixable one, then the one that is really a
  // redirection of effort. Levels N0–N4 replace the class test when E14 ships.
  if (weakClass && !hasNetwork) {
    return {
      id: 'perdida',
      reason:
        input.territorialClass === 'sem_base'
          ? 'Sem base eleitoral medida em 2022 e sem rede local: a visita não tem quem converta.'
          : 'Classe marginal (pouca base e pouco campo a capturar) e sem rede local: a visita não tem quem converta.',
      counterOffer: 'Mande o coordenador de território antes; visita só depois de haver rede.',
    }
  }

  if (!hasNetwork) {
    return {
      id: 'sem_rede',
      reason: 'Nenhuma liderança ou compromisso registrado: não há quem receba e mobilize.',
      counterOffer:
        'Ofereça uma reunião com o coordenador ou um vídeo, e cadastre a rede primeiro.',
    }
  }

  const headroom = conditions.find((condition) => condition.id === 'headroom')
  if (headroom && !headroom.met) {
    return {
      id: 'no_teto',
      reason:
        'Meta já coberta e pouco campo não capturado: o dia do candidato rende mais em outro município.',
      counterOffer: 'Encaixe como parada curta num giro, ou troque por um município com déficit.',
    }
  }

  return null
}

export const evaluateVisitEligibility = (input: VisitEligibilityInput): VisitEligibility => {
  const conditions: VisitCondition[] = [
    volumeCondition(input),
    headroomCondition(input),
    redeCondition(input),
    janelaCondition(input),
    encaixeCondition(input),
  ]

  return {
    conditions,
    metCount: conditions.filter((condition) => condition.met).length,
    contraindication: resolveContraindication(input, conditions),
  }
}

/**
 * The calendar changes the PRODUCT of a visit, not only its urgency (research
 * report §6.7): in July a visit exists to build the network, in the last week
 * it exists to move people who are already with you.
 */
export const resolveCalendarPhase = (now: Date): CalendarPhase => {
  const today = formatBahiaCivilDate(now)
  if (today >= CALENDAR_PHASE_ANCHORS.activationStart) return 'ativacao'
  if (today >= CALENDAR_PHASE_ANCHORS.consolidationStart) return 'consolidacao'
  return 'construcao'
}

export const calendarPhaseLabels: Record<CalendarPhase, string> = {
  construcao: 'Construção',
  consolidacao: 'Consolidação',
  ativacao: 'Ativação',
}

/** What a visit is FOR in each phase — the copy the composer suggests per stop. */
export const calendarPhaseVisitProduct: Record<CalendarPhase, string> = {
  construcao: 'Reunião com lideranças: montar e ativar a rede local.',
  consolidacao: 'Fechar compromissos de voto e casar a dobradinha estadual.',
  ativacao: 'Mobilizar quem já está com a gente: ato, caminhada, boca de urna.',
}

/**
 * Headlines say what to do, not how bad it is: "não vá" is staff vocabulary for
 * a deprioritization, and the same município is never told it was written off.
 */
export const visitContraindicationLabels: Record<VisitContraindicationId, string> = {
  perdida: 'Não recomendado agora',
  sem_rede: 'Falta rede para receber',
  no_teto: 'Rende mais em outro município',
}

export const visitConditionLabels: Record<VisitConditionId, string> = {
  volume: 'Volume eleitoral',
  headroom: 'Espaço para crescer',
  rede: 'Rede de recepção',
  janela: 'Janela política',
  encaixe: 'Encaixe em giro',
}
