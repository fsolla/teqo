/**
 * E13 — the dates that split the campaign calendar into phases, in one
 * client-safe module, on the precedent of `territorialClassAnchors.ts`: the
 * planner's copy and the eligibility evaluator both read from here, so moving
 * a phase is a one-line diff in one file.
 *
 * Cuts are ILLUSTRATIVE of the 2026 calendar the research report describes
 * (construção jul–ago, consolidação set, ativação na última semana), anchored
 * on two real dates — the legal start of the campaign and the vote — but the
 * exact turn of "consolidação → ativação" is a judgement call the coordination
 * makes, not a statute. Recalibration is E15's job, same as E10's anchors.
 */
export const CALENDAR_PHASES = ['construcao', 'consolidacao', 'ativacao'] as const

export type CalendarPhase = (typeof CALENDAR_PHASES)[number]

/**
 * Bahia civil dates as `aaaa-mm-dd`, compared lexicographically against
 * `formatBahiaCivilDate` — never as `Date` instances, so the phase turns at
 * midnight in Bahia and not in UTC.
 */
export const CALENDAR_PHASE_ANCHORS = {
  /** Legal start of the campaign (Lei 9.504/97, art. 36): propaganda opens. */
  consolidationStart: '2026-08-16',
  /** Last week before the vote — the phase where only mobilization pays. */
  activationStart: '2026-09-28',
  /** Election day (1º turno, 2026). */
  electionDay: '2026-10-04',
} as const
