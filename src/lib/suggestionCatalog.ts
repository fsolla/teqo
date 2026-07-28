import {
  formatElectionNumber,
  formatVoteSharePercent,
  oneDecimalFormatter,
} from '@/lib/electionFormat'
import type { EngagementLevel } from '@/lib/engagementLevel'
import { engagementLevelRank } from '@/lib/engagementLevel'
import type { AllocationDecision } from '@/payload-types'
import type { MunicipalityTerritorialClass } from '@/utilities/municipalityTerritorialClass'

/**
 * Mirrors `ELECTION_YEAR_*` from `lib/electionResults` WITHOUT importing it:
 * that module's first import is `bahiaTerritories`, and this catalog ships in
 * the client card's chunk — three numbers must not drag the territory table
 * into the browser (the B14 lesson, again).
 */
const YEAR_2014 = 2014
const YEAR_2018 = 2018
const YEAR_2022 = 2022

/**
 * E11 "motor de sugestões" — the versioned, curated catalog of data→decision
 * patterns from the research report (§6.1), as pure predicates over derived
 * numbers plus the exact copy the cards render. The evaluator
 * (`utilities/municipalityTriggers.ts`) assembles the inputs; this module owns
 * WHAT fires and WHAT it says, so a pattern's trigger and its text are
 * reviewed in the same diff (the same contract E18 keeps for concepts).
 *
 * Client-safe on purpose: the dismiss form offers each pattern's alternative
 * readings as quick picks, so the browser needs the texts — and the predicates
 * are plain arithmetic over an input of numbers, no artifact import.
 *
 * Every cut below is ILLUSTRATIVE and calibratable (statute of the whole
 * catalog, §6): the backtest (E15) is the calibration path. None of these
 * numbers may be rendered in the UI as an exact threshold (§6.4 gaming).
 */

export const suggestionPatternIds = ['P1', 'P2', 'P3', 'P5', 'P6', 'P7', 'K-A', 'K-B'] as const

export type SuggestionPatternId = (typeof suggestionPatternIds)[number]

/** §6.2 — 1 estoque em risco confirmado … 5 otimização/higiene. */
export type SuggestionTriageLevel = 1 | 2 | 3 | 4 | 5

/** The research names for the five levels — shown with the number, never instead of it. */
export const suggestionTriageLabels: Record<SuggestionTriageLevel, string> = {
  1: 'Estoque em risco',
  2: 'Falha de canal',
  3: 'Cobertura zero',
  4: 'Janela de oportunidade',
  5: 'Otimização e higiene',
}

export type TriggeredPattern = {
  patternId: SuggestionPatternId
  triageLevel: SuggestionTriageLevel
  /** Observed facts behind the trigger — the card never shows the label alone. */
  factors: string[]
}

/**
 * Everything a predicate may look at, already derived. Counts and ratios are
 * observations; the `*Cut` fields are catalog-wide references the evaluator
 * computes once (medians/quartile over the 435), so one suggestion means the
 * same thing for every viewer.
 */
export type MunicipalityTriggerInput = {
  priority: 'alta' | 'normal' | null
  engagementLevel: EngagementLevel | null
  territorialClass: MunicipalityTerritorialClass
  inCoreBlock: boolean

  /** Location quotient per election year (E10 formula); null without electorate. */
  lqByYear: Record<number, number | null>
  ownVotesByYear: Record<number, number>
  projectedValidVotes: number
  projectedValidVotesCut: number
  projectedValidVotesUpperCut: number
  uncapturedFieldVotes: number
  uncapturedFieldVotesCut: number
  captureRate2022: number | null
  /** Campo federal votes ÷ valid votes, 2022 — "captura agregada do campo". */
  fieldShareOfValid2022: number | null
  /** Own votes ÷ campo federal votes, 2022. */
  intraFieldShare2022: number | null
  /** The candidate's own statewide intra-field share, 2022 — the relative standard. */
  intraFieldShareStateStandard2022: number | null

  advisorCount: number
  leadershipCount: number
  pledgeCount: number

  /** Days since max(lastUpdateAt, lastPledgeAt); null = never. */
  lastSignalAgeDays: number | null
  /** Days since the last pledge declaration/estimate; null = never. */
  lastPledgeAgeDays: number | null

  /** Central-scenario goal coverage (E8 semantics). */
  coverageRatio: number | null
  coverageDeficit: number

  /** Most severe adversary signal within the window, if any (P1 variant). */
  adversarySignal: { triangulated: boolean } | null
  /** Any non-draft activity recently held or upcoming (the "agenda" leg of P1). */
  hasRecentOrUpcomingActivity: boolean
  /** Activities `realizado` within the effort window (K-A's "esforço no ciclo"). */
  completedActivityCount: number
}

/**
 * Illustrative anchors, versioned in one object like
 * `TERRITORIAL_CLASS_ANCHORS` / `visitPlannerAnchors` — recalibration (E15) is
 * a one-line diff here, never a UI string.
 */
const SUGGESTION_ANCHORS = {
  /** P1: days without pledge/sinal before a reduto reads dormant (research: 3–4 weeks; E9's cold threshold). */
  dormantSignalDays: 21,
  /** P1 variant: own 2022 vote at or below this multiple of 2018 reads as a drop. */
  voteDropRatio: 0.85,
  /** P3: campo share of local valid votes that reads "campo forte". */
  strongFieldShareOfValid: 0.35,
  /** P3: own intra-field share below this multiple of the own statewide standard. */
  weakIntraFieldMultiple: 0.5,
  /** P5: minimum LQ growth across the 2014→2022 series to read as rising. */
  risingLqGrowthRatio: 1.2,
  /** P7: days without pledge movement in a prioritized município. */
  stagnantPledgeDays: 21,
  /** K-A: days without pledge movement AFTER recorded effort. */
  investedStagnantPledgeDays: 28,
  /** K-B: capture rate below this reads as minimal. */
  minimalCaptureRate: 0.02,
  /** Silence review: days without any signal (monthly cadence, §6.4 viés da base). */
  silenceDays: 30,
} as const

/**
 * §6.4 churn mitigation — how long a recorded decision keeps the same pattern
 * out of the queue. A postponement carries its own `suppressUntil` in the
 * snapshot; these cover accept/dismiss.
 */
export const SUGGESTION_SUPPRESSION_DAYS = {
  aceita: 14,
  descarta: 30,
} as const

/** 7 days by default; low-urgency levels (4–5) snooze for 14. */
export const suggestionPostponeDays = (level: SuggestionTriageLevel): number =>
  level >= 4 ? 14 : 7

/** Derived over every level so a recalibration cannot silently invert them. */
const TRIAGE_LEVELS: readonly SuggestionTriageLevel[] = [1, 2, 3, 4, 5]
const SHORTEST_POSTPONE_DAYS = Math.min(...TRIAGE_LEVELS.map(suggestionPostponeDays))
const LONGEST_POSTPONE_DAYS = Math.max(...TRIAGE_LEVELS.map(suggestionPostponeDays))

/** Windows the evaluator uses when it assembles signal/agenda inputs. */
export const SUGGESTION_INPUT_WINDOWS = {
  /** Days an adversary signal stays "recent" for P1. */
  adversarySignalDays: 28,
  /** Days back an activity still counts as agenda (P1) or effort (K-A). */
  activityDays: 42,
  /**
   * Days back the evaluator fetches decisions: nothing older than the longest
   * suppression window (or the longest postpone) can still hide a pattern, so
   * the fetch window is derived instead of guessed — decision rows are jsonb
   * and grow with real use.
   */
  decisionDays: Math.max(
    SUGGESTION_SUPPRESSION_DAYS.aceita,
    SUGGESTION_SUPPRESSION_DAYS.descarta,
    LONGEST_POSTPONE_DAYS,
  ),
} as const

/** One place for the day math the suggestion modules share. */
export const DAY_MS = 86_400_000

const decisionSnapshotValue = (snapshot: unknown, key: string): unknown => {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return null
  return (snapshot as Record<string, unknown>)[key]
}

/** Cap shared by the zod schema and the card's textareas (the collection's own limit). */
export const SUGGESTION_TEXT_MAX_LENGTH = 2000

export type SuggestionDecisionLike = {
  outcome: AllocationDecision['outcome']
  createdAt: string
  snapshot: unknown
}

/**
 * §6.4 churn mitigation: a recorded decision keeps the same pattern out of the
 * queue for a window — except that a CONFIRMED risk (level 1) fires through a
 * decision recorded at lower urgency ("nível 1 fura a fila"). Pure so the rule
 * that decides what the coordinator does NOT see is pinned by unit tests.
 */
export const isSuggestionSuppressedByDecision = (
  decision: SuggestionDecisionLike,
  triggered: Pick<TriggeredPattern, 'triageLevel'>,
  now: Date,
): boolean => {
  const decidedLevelRaw = decisionSnapshotValue(decision.snapshot, 'triageLevel')
  const decidedLevel = typeof decidedLevelRaw === 'number' ? decidedLevelRaw : null
  if (triggered.triageLevel === 1 && (decidedLevel === null || decidedLevel > 1)) return false

  const decidedAtMs = new Date(decision.createdAt).getTime()
  if (Number.isNaN(decidedAtMs)) return false

  if (decision.outcome === 'adiada') {
    const untilRaw = decisionSnapshotValue(decision.snapshot, 'suppressUntil')
    const untilMs = typeof untilRaw === 'string' ? new Date(untilRaw).getTime() : Number.NaN
    if (!Number.isNaN(untilMs)) return now.getTime() < untilMs
    // Malformed snapshot: fall back to the shortest postpone rather than never expiring.
    return now.getTime() < decidedAtMs + SHORTEST_POSTPONE_DAYS * DAY_MS
  }
  if (decision.outcome === 'aceita') {
    return now.getTime() < decidedAtMs + SUGGESTION_SUPPRESSION_DAYS.aceita * DAY_MS
  }
  if (decision.outcome === 'descarta') {
    return now.getTime() < decidedAtMs + SUGGESTION_SUPPRESSION_DAYS.descarta * DAY_MS
  }
  return false
}

type SuggestionMenuAction = {
  id: string
  label: string
}

export type SuggestionPattern = {
  id: SuggestionPatternId
  title: string
  probableReading: string
  /** The "descartar antes" list — quick picks of the dismiss form. */
  alternativeReadings: string[]
  /** Ordered cheap-before-expensive (§6.2); the first item is the 48h check. */
  menu: SuggestionMenuAction[]
  contraindication: string
  evaluate: (input: MunicipalityTriggerInput) => TriggeredPattern | null
}

/** Statute of the whole catalog (§6 header) — every card shows it. */
export const SUGGESTION_STATUTE =
  'Hipótese de literatura (relatório §6.1) — menu para o julgamento do staff, nunca regra automática; cortes ilustrativos, calibráveis pelo backtest.'

const formatLqMultiple = (value: number): string => `${oneDecimalFormatter.format(value)}×`

const isEngagedAtLeastN2 = (level: EngagementLevel | null): boolean =>
  level !== null && engagementLevelRank[level] >= engagementLevelRank.n2

const isPrioritized = (input: MunicipalityTriggerInput): boolean =>
  input.priority === 'alta' || isEngagedAtLeastN2(input.engagementLevel)

const signalAgeFactor = (ageInDays: number | null): string =>
  ageInDays === null
    ? 'Nunca recebeu sinal registrado'
    : `Sem sinal registrado há ${ageInDays} dias`

/**
 * P3's structural condition, shared so P2/K-B can exclude it (the machine owns
 * the structural differential — §6.3): the campo holds the município, and the
 * candidate's slice of the campo is far below his own statewide standard.
 */
const holdsP3Condition = (input: MunicipalityTriggerInput): boolean => {
  const { fieldShareOfValid2022, intraFieldShare2022, intraFieldShareStateStandard2022 } = input
  if (
    fieldShareOfValid2022 === null ||
    intraFieldShare2022 === null ||
    intraFieldShareStateStandard2022 === null ||
    intraFieldShareStateStandard2022 <= 0
  ) {
    return false
  }
  return (
    fieldShareOfValid2022 >= SUGGESTION_ANCHORS.strongFieldShareOfValid &&
    intraFieldShare2022 <
      intraFieldShareStateStandard2022 * SUGGESTION_ANCHORS.weakIntraFieldMultiple
  )
}

/**
 * K-B's structural condition, shared so P2 can exclude it: apparent field
 * headroom, but the candidate's capture stayed minimal across the whole
 * series — someone else consolidated the município.
 */
const holdsKbCondition = (input: MunicipalityTriggerInput): boolean => {
  if (input.uncapturedFieldVotes < input.uncapturedFieldVotesCut) return false
  if (input.captureRate2022 === null) return false
  if (input.captureRate2022 >= SUGGESTION_ANCHORS.minimalCaptureRate) return false
  if (holdsP3Condition(input)) return false

  const seriesLqs = [YEAR_2014, YEAR_2018, YEAR_2022]
    .map((year) => input.lqByYear[year])
    .filter((lq): lq is number => typeof lq === 'number')
  if (seriesLqs.length < 2) return false
  return seriesLqs.every((lq) => lq < 1)
}

const patternP1: SuggestionPattern = {
  id: 'P1',
  title: 'Reduto dormente ou ameaçado',
  probableReading:
    'Vulnerabilidade à invasão (Ames): estoque quase-certo sem vigilância registrada é o alvo mais barato de um adversário racional.',
  alternativeReadings: [
    'Dormência de registro — a rede trabalha e não digita',
    'Broker ocupado, mas fiel',
  ],
  menu: [
    {
      id: 'checagem-rede',
      label: 'Checagem de rede em 48h — o responsável liga e atualiza os pledges',
    },
    { id: 'presenca-curta', label: 'Presença pessoal curta se a ameaça se confirmar' },
    { id: 'segunda-linha', label: 'Ativar a segunda linha de lideranças' },
    { id: 'escalar-federacao', label: 'Se a invasão for intracampo, escalar à federação' },
  ],
  contraindication:
    'Não despejar agenda cara antes da checagem barata; não superinvestir em reduto já no teto.',
  evaluate: (input) => {
    if (input.territorialClass !== 'reduto' || !input.inCoreBlock) return null

    const threatened = input.adversarySignal !== null
    const own2018 = input.ownVotesByYear[YEAR_2018] ?? 0
    const own2022 = input.ownVotesByYear[YEAR_2022] ?? 0
    const dropped = own2018 > 0 && own2022 <= own2018 * SUGGESTION_ANCHORS.voteDropRatio
    const dormant =
      (input.lastSignalAgeDays === null ||
        input.lastSignalAgeDays >= SUGGESTION_ANCHORS.dormantSignalDays) &&
      !input.hasRecentOrUpcomingActivity
    if (!threatened && !dropped && !dormant) return null

    const lq2022 = input.lqByYear[YEAR_2022]
    const factors: string[] = []
    if (typeof lq2022 === 'number') {
      factors.push(`${formatLqMultiple(lq2022)} o padrão estadual do candidato`)
    }
    if (threatened) {
      factors.push(
        input.adversarySignal?.triangulated
          ? 'Sinal de adversário registrado e triangulado'
          : 'Sinal de adversário registrado (fonte única)',
      )
    }
    if (dropped) {
      factors.push(
        `Votação própria caiu de ${formatElectionNumber(own2018)} (2018) para ${formatElectionNumber(own2022)} (2022)`,
      )
    }
    if (dormant) factors.push(`${signalAgeFactor(input.lastSignalAgeDays)}, sem agenda no período`)

    const triageLevel: SuggestionTriageLevel = input.adversarySignal
      ? input.adversarySignal.triangulated
        ? 1
        : 2
      : 3
    return { patternId: 'P1', triageLevel, factors }
  },
}

const patternP2: SuggestionPattern = {
  id: 'P2',
  title: 'Ataque: campo forte, captura baixa',
  probableReading:
    'Expansão clássica: voto de campo sem dono para deputado federal — recepção antes de agenda.',
  alternativeReadings: [
    'Correligionário já capturou o campo (ver P3)',
    'Barreira de entrada alta / "posse" de candidato regional',
    'Disputa local fechada — perdida vestida de oportunidade',
  ],
  menu: [
    { id: 'recrutar-lideranca', label: 'Recrutar liderança ou organização local ANTES de agenda' },
    { id: 'atividade-aliada', label: 'Atividade com organização aliada' },
    { id: 'dobradinha-local', label: 'Dobradinha com estadual forte no município' },
    { id: 'agenda-com-recepcao', label: 'Agenda só quando houver recepção pronta' },
  ],
  contraindication:
    'Disputa local fechada + dominância adversária = município perdido vestido de oportunidade (persuasão ≈ 0).',
  evaluate: (input) => {
    if (input.territorialClass !== 'expansao') return null
    if (input.uncapturedFieldVotes < input.uncapturedFieldVotesCut) return null
    if (input.projectedValidVotes < input.projectedValidVotesCut) return null
    // Structural differential (§6.3): if a correligionário holds it, or the
    // series says "perdida", those patterns speak — not the attack call.
    if (holdsP3Condition(input) || holdsKbCondition(input)) return null

    const factors = [`${formatElectionNumber(input.uncapturedFieldVotes)} votos do campo sem dono`]
    if (input.captureRate2022 !== null) {
      factors.push(`Captura de ${formatVoteSharePercent(input.captureRate2022)} do teto do campo`)
    }
    return { patternId: 'P2', triageLevel: 4, factors }
  },
}

const patternP3: SuggestionPattern = {
  id: 'P3',
  title: 'Correligionário na frente',
  probableReading: 'O município está organizado — por outro candidato do campo (Nicolau).',
  alternativeReadings: [
    'Acordo de território vigente',
    'Correligionário em saída — herança aberta (acelerar a entrada)',
  ],
  menu: [
    { id: 'inteligencia', label: 'Inteligência: concorre de novo? A força vem de que broker?' },
    { id: 'heranca-aberta', label: 'Herança aberta → entrada rápida nas lideranças órfãs' },
    { id: 'flanquear', label: 'Ativo e forte → flanquear segmento não coberto' },
    { id: 'nao-agressao', label: 'Acordo de não-agressão via federação' },
  ],
  contraindication:
    'Guerra aberta em reduto de correligionário forte: custo alto, envenena a lista de que todos dependem.',
  evaluate: (input) => {
    if (!holdsP3Condition(input)) return null
    // Volume gate (calibrável): the menu costs intelligence work — worth it
    // where the campo vote at stake is material, or a strong-campo interior
    // town of 2 000 válidos floods the queue in week one.
    if (input.projectedValidVotes < input.projectedValidVotesCut) return null

    const factors: string[] = []
    if (input.fieldShareOfValid2022 !== null) {
      factors.push(
        `Campo captura ${formatVoteSharePercent(input.fieldShareOfValid2022)} dos válidos`,
      )
    }
    if (input.intraFieldShare2022 !== null && input.intraFieldShareStateStandard2022 !== null) {
      factors.push(
        `Fatia intracampo de ${formatVoteSharePercent(input.intraFieldShare2022)} (padrão estadual do candidato: ${formatVoteSharePercent(input.intraFieldShareStateStandard2022)})`,
      )
    }
    return { patternId: 'P3', triageLevel: 4, factors }
  },
}

const patternP5: SuggestionPattern = {
  id: 'P5',
  title: 'Expansão acima do padrão',
  probableReading: 'Trajetória dos vencedores em ato: base → região → dispersão.',
  alternativeReadings: [
    'Evento único ou broker recém-chegado, não tendência',
    'Meta subestimada — a régua é que está errada',
  ],
  menu: [
    {
      id: 'dobrar-aposta',
      label: 'Dobrar a aposta com custo marginal baixo (material, atividades)',
    },
    { id: 'formalizar-rede', label: 'Formalizar a rede emergente antes que esfrie' },
    { id: 'replicar-vizinhanca', label: 'Replicar por vizinhança no mesmo território' },
    { id: 'subir-meta', label: 'Subir a meta e realimentar a decomposição' },
  ],
  contraindication: 'Não canibalizar a agenda de defesa pela novidade; multidão ≠ tendência.',
  evaluate: (input) => {
    if (input.territorialClass === 'sem_base') return null

    const lq2014 = input.lqByYear[YEAR_2014]
    const lq2018 = input.lqByYear[YEAR_2018]
    const lq2022 = input.lqByYear[YEAR_2022]
    const rising =
      typeof lq2014 === 'number' &&
      typeof lq2018 === 'number' &&
      typeof lq2022 === 'number' &&
      lq2014 < lq2018 &&
      lq2018 < lq2022 &&
      lq2022 >= lq2014 * SUGGESTION_ANCHORS.risingLqGrowthRatio
    const overCovered = input.coverageRatio !== null && input.coverageRatio > 1
    if (!rising && !overCovered) return null

    const factors: string[] = []
    if (rising) {
      factors.push(
        `LQ subiu de ${formatLqMultiple(lq2014)} (2014) para ${formatLqMultiple(lq2022)} (2022)`,
      )
    }
    if (overCovered && input.coverageRatio !== null) {
      factors.push(`Cobertura da meta em ${formatVoteSharePercent(input.coverageRatio)}`)
    }
    return { patternId: 'P5', triageLevel: 4, factors }
  },
}

const patternP6: SuggestionPattern = {
  id: 'P6',
  title: 'Município grande sem rede',
  probableReading:
    'Voto órfão (histórico sem rede registrada) ou deserto (nunca teve) — o censo de rede separa os dois.',
  alternativeReadings: [
    'Voto órfão — a rede existe, só não está registrada (censo primeiro)',
    'Deserto real com campo fraco — despriorizar por escrito',
  ],
  menu: [
    { id: 'censo-rede', label: 'Censo de rede via federação e organizações' },
    { id: 'nomear-responsavel', label: 'Nomear responsável (mesmo externo)' },
    { id: 'tratar-como-ataque', label: 'Deserto com campo forte → tratar como ataque (P2)' },
    { id: 'despriorizar', label: 'Deserto com campo fraco → despriorizar por escrito' },
  ],
  contraindication:
    'Agenda para "abrir" o município sem estrutura de recepção — visita sem broker evapora (Nielsen).',
  evaluate: (input) => {
    if (input.projectedValidVotes < input.projectedValidVotesUpperCut) return null
    if (input.leadershipCount > 0 || input.advisorCount > 0 || input.pledgeCount > 0) return null

    const factors = [
      `${formatElectionNumber(input.projectedValidVotes)} válidos projetados — quartil superior do catálogo`,
      'Nenhuma liderança, assessor ou pledge registrado',
    ]
    return { patternId: 'P6', triageLevel: isPrioritized(input) ? 3 : 5, factors }
  },
}

const patternP7: SuggestionPattern = {
  id: 'P7',
  title: 'Pledges estagnados vs. meta',
  probableReading:
    'Leitura tripla: (i) a rede parou · (ii) a rede trabalha e não registra · (iii) a rede saturou o alcance. Auditoria amostral separa (ii); pledges no teto histórico denunciam (iii).',
  alternativeReadings: [
    'A rede trabalha e não registra — consertar o fluxo (sede digita)',
    'A rede saturou o alcance — teto histórico atingido',
  ],
  menu: [
    { id: 'diagnostico-diferencial', label: 'Diagnóstico diferencial pelo responsável (1 semana)' },
    { id: 'consertar-registro', label: 'Se falta registro: consertar o fluxo (sede digita)' },
    { id: 'reativacao', label: 'Se a rede parou: reativação pessoal da rede' },
    {
      id: 'recrutar-ou-realocar',
      label: 'Se saturou: recrutar novas lideranças ou realocar a meta',
    },
  ],
  contraindication:
    'Não cobrar a rede pelo número antes de auditar o registro — pune quem trabalha e ensina a inflar.',
  evaluate: (input) => {
    if (!isPrioritized(input)) return null
    if (input.pledgeCount === 0) return null
    if (input.coverageRatio === null || input.coverageRatio >= 1) return null
    if (
      input.lastPledgeAgeDays === null ||
      input.lastPledgeAgeDays < SUGGESTION_ANCHORS.stagnantPledgeDays
    ) {
      return null
    }
    // With recorded effort in the cycle, the sharper diagnosis is K-A.
    if (input.completedActivityCount > 0) return null

    const factors = [
      `Cobertura em ${formatVoteSharePercent(input.coverageRatio)} da meta`,
      `Último pledge há ${input.lastPledgeAgeDays} dias`,
    ]
    return { patternId: 'P7', triageLevel: 5, factors }
  },
}

const patternKA: SuggestionPattern = {
  id: 'K-A',
  title: 'Não responde a investimento',
  probableReading:
    'O terreno pode não responder — mas execução ruim e sub-registro respondem igual. Autópsia execução × terreno antes de culpar o município.',
  alternativeReadings: [
    'Sub-registro — o esforço responde, ninguém digita',
    'Execução ruim, não terreno ruim',
    'Resposta lenta em município grande, não nula',
  ],
  menu: [
    {
      id: 'autopsia',
      label:
        'Autópsia execução × terreno (1 semana) — descartar sub-registro antes de culpar o terreno',
    },
    { id: 'rebaixar-um-nivel', label: 'Rebaixar UM nível com sinais de reversão ex-ante' },
    { id: 'realocar-irmao', label: 'Realocar para município-irmão do território com headroom' },
  ],
  contraindication:
    'Não rebaixar dentro da janela de proteção; resposta lenta ≠ nula em município grande.',
  evaluate: (input) => {
    if (input.completedActivityCount === 0) return null
    if (input.coverageRatio === null || input.coverageRatio >= 1) return null
    if (
      input.lastPledgeAgeDays !== null &&
      input.lastPledgeAgeDays < SUGGESTION_ANCHORS.investedStagnantPledgeDays
    ) {
      return null
    }

    const factors = [
      `${formatElectionNumber(input.completedActivityCount)} atividade(s) realizada(s) no ciclo recente`,
      input.lastPledgeAgeDays === null
        ? 'Nenhum pledge registrado até hoje'
        : `Pledges parados há ${input.lastPledgeAgeDays} dias`,
    ]
    return { patternId: 'K-A', triageLevel: 5, factors }
  },
}

const patternKB: SuggestionPattern = {
  id: 'K-B',
  title: 'Perdida vestida de oportunidade',
  probableReading:
    'Perdida neste ciclo, não nesta década: o headroom é miragem enquanto a dominância de outro se mantém.',
  alternativeReadings: [
    'Efeito-hub — contiguidade estratégica com reduto vizinho',
    'Mudança local iminente ("se fulano sair, reavaliar")',
  ],
  menu: [
    {
      id: 'classificar-n0-n1',
      label: 'Classificar N0/N1 por escrito e tirar da lista de tentação',
    },
    { id: 'sinal-reversao', label: 'Registrar o sinal de reversão ("se fulano sair, reavaliar")' },
    { id: 'semente-minima', label: 'Semente mínima se contígua a reduto' },
  ],
  contraindication: 'Roll-off sozinho não é tese de entrada; não queimar a relação local ao sair.',
  evaluate: (input) => {
    if (!holdsKbCondition(input)) return null

    const factors = [`${formatElectionNumber(input.uncapturedFieldVotes)} votos de campo aparentes`]
    if (input.captureRate2022 !== null) {
      factors.push(
        `Captura de ${formatVoteSharePercent(input.captureRate2022)} do teto, mínima em toda a série`,
      )
    }
    return { patternId: 'K-B', triageLevel: 5, factors }
  },
}

export const suggestionPatterns: readonly SuggestionPattern[] = [
  patternP1,
  patternP2,
  patternP3,
  patternP5,
  patternP6,
  patternP7,
  patternKA,
  patternKB,
]

const patternById = new Map(suggestionPatterns.map((pattern) => [pattern.id, pattern]))

export const getSuggestionPattern = (id: SuggestionPatternId): SuggestionPattern => {
  const pattern = patternById.get(id)
  if (!pattern) throw new Error(`Padrão de sugestão desconhecido: ${id}`)
  return pattern
}

/** All patterns evaluated, sorted by triage level (1 first). Pure. */
export const evaluateMunicipalityTriggers = (input: MunicipalityTriggerInput): TriggeredPattern[] =>
  suggestionPatterns
    .map((pattern) => pattern.evaluate(input))
    .filter((triggered): triggered is TriggeredPattern => triggered !== null)
    .sort((left, right) => left.triageLevel - right.triageLevel)

/**
 * "Pauta do silêncio" (§6.4 viés da base): a prioritized município where NO
 * pattern fired and nothing was recorded for a month is a question, not
 * comfort. Includes `priority: alta` beside N2+ because E14 shipped without a
 * backfill — levels are still being triaged.
 */
export const shouldEnterSilenceReview = (
  input: MunicipalityTriggerInput,
  triggeredCount: number,
): boolean =>
  triggeredCount === 0 &&
  isPrioritized(input) &&
  (input.lastSignalAgeDays === null || input.lastSignalAgeDays >= SUGGESTION_ANCHORS.silenceDays)
