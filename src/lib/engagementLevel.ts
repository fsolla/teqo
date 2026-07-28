/**
 * E14 — the N0–N4 engagement ladder and the movement rules that guard it.
 * Pure and client-safe: the collection, the server action, the list URL and
 * the Popover control all read the ladder from here, and the rules are unit
 * tested without a database.
 *
 * The cuts below are the ones the research report (§6.8) proposes and are
 * ILLUSTRATIVE — calibrating them against real movement is E15. They live in
 * one object so recalibration is a one-line diff.
 */

export const engagementLevels = ['n0', 'n1', 'n2', 'n3', 'n4'] as const

/** `allocationDecision.patternId` under which every level movement is filed. */
export const ENGAGEMENT_LEVEL_PATTERN_ID = 'nivel'

/** Cap shared by the field, the schema and the textareas, so they agree. */
export const ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH = 2000

export type EngagementLevel = (typeof engagementLevels)[number]

/**
 * Ordinal position on the ladder, for measuring the DISTANCE of a movement —
 * ordering is Postgres's job (the column sorts lexicographically in this same
 * order). A table rather than `engagementLevels.indexOf` so the lookup is total
 * and cannot answer -1.
 */
export const engagementLevelRank: Record<EngagementLevel, number> = {
  n0: 0,
  n1: 1,
  n2: 2,
  n3: 3,
  n4: 4,
}

export const isEngagementLevel = (value: unknown): value is EngagementLevel =>
  typeof value === 'string' && engagementLevels.includes(value as EngagementLevel)

/** The ladder as the mesa says it out loud (research §6.8). */
const engagementLevelNames: Record<EngagementLevel, string> = {
  n0: 'Monitorar',
  n1: 'Presença de mandato',
  n2: 'Rede sem agenda',
  n3: 'Rede + agenda',
  n4: 'Investimento pleno',
}

/**
 * "N3 · Rede + agenda" — the numeral alone is the badge, this is the tooltip.
 * Here rather than in `municipalityLabels` so the Popover island can name a
 * level without importing a module that builds the 435-entry catalog and the
 * concept glossary at init.
 */
export const formatEngagementLevelLabel = (level: EngagementLevel): string =>
  `${level.toUpperCase()} · ${engagementLevelNames[level]}`

export const EMPTY_ENGAGEMENT_LEVEL_LABEL = 'Sem nível'

/**
 * Hysteresis, so the ladder records decisions instead of oscillating with the
 * mood of the week (research §6.8).
 */
export const ENGAGEMENT_LEVEL_RULES = {
  /**
   * A freshly decided level is protected from being undone for this long.
   * §6.8 words this as protecting a PROMOTION; guarding any recent decision is
   * both stricter and derivable from `levelChangedAt` alone — knowing the
   * direction of the last movement would cost a query the control cannot make.
   * The override covers the difference; E15 calibrates.
   */
  protectionWindowDays: 21,
  /** Beyond this distance a single movement needs a triangulated shock. */
  maxStepsWithoutShock: 1,
} as const

export type EngagementLevelViolationId =
  | 'salto-de-dois-niveis'
  | 'janela-de-protecao'
  | 'dois-movimentos-no-mes'

export type EngagementLevelViolation = {
  id: EngagementLevelViolationId
  /** Rendered to the coordinator as the reason the movement is being held. */
  message: string
}

export type EngagementLevelMovementInput = {
  from: EngagementLevel | null
  to: EngagementLevel
  /** When the current level was recorded; null when the município never had one. */
  levelChangedAt: string | null
  now: Date
  /** The coordinator declared a triangulated shock, which licenses a 2-level jump. */
  triangulatedShock: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

const daysBetween = (from: Date, to: Date): number => (to.getTime() - from.getTime()) / DAY_MS

const isSameCalendarMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()

/**
 * The movement rules, as a list rather than a boolean: the control shows the
 * coordinator every reason at once, and the accepted override is stored with
 * exactly the reasons it overrode.
 *
 * "Two movements in a month" needs no history query — the movement being made
 * is at least the second one of the month precisely when the previous one
 * landed in the same calendar month.
 */
export const getEngagementLevelViolations = ({
  from,
  to,
  levelChangedAt,
  now,
  triangulatedShock,
}: EngagementLevelMovementInput): EngagementLevelViolation[] => {
  // The first level a município ever gets is a starting point, not a movement:
  // there is nothing to oscillate against yet.
  if (from === null || from === to) return []

  const violations: EngagementLevelViolation[] = []
  const steps = Math.abs(engagementLevelRank[to] - engagementLevelRank[from])
  const isPromotion = engagementLevelRank[to] > engagementLevelRank[from]

  if (steps > ENGAGEMENT_LEVEL_RULES.maxStepsWithoutShock && !triangulatedShock) {
    violations.push({
      id: 'salto-de-dois-niveis',
      message: `Movimento de ${steps} níveis de uma vez. Só com choque triangulado.`,
    })
  }

  const changedAt = levelChangedAt ? new Date(levelChangedAt) : null
  const hasChangedAt = changedAt !== null && !Number.isNaN(changedAt.getTime())

  if (hasChangedAt) {
    const daysSinceChange = daysBetween(changedAt, now)

    if (!isPromotion && daysSinceChange < ENGAGEMENT_LEVEL_RULES.protectionWindowDays) {
      violations.push({
        id: 'janela-de-protecao',
        message: `O nível atual tem menos de ${ENGAGEMENT_LEVEL_RULES.protectionWindowDays} dias. Rebaixar agora desfaz uma decisão dentro da janela de proteção.`,
      })
    }

    if (isSameCalendarMonth(changedAt, now)) {
      violations.push({
        id: 'dois-movimentos-no-mes',
        message: 'Este município já mudou de nível neste mês.',
      })
    }
  }

  return violations
}

/**
 * Thrown by the server action when a movement breaks a rule and the
 * coordinator has not overridden it. It carries the reasons so the route can
 * answer with them and the control can offer the override in place, instead of
 * collapsing everything into one opaque "não foi possível salvar".
 */
export class EngagementLevelBlockedError extends Error {
  readonly violations: EngagementLevelViolation[]

  constructor(violations: EngagementLevelViolation[]) {
    super('O movimento contraria as regras de estabilidade do nível.')
    this.name = 'EngagementLevelBlockedError'
    this.violations = violations
  }
}
