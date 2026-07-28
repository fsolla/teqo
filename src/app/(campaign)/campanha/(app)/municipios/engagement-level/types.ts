import type { EngagementLevel, EngagementLevelViolation } from '@/lib/engagementLevel'

/**
 * `blocked` is a third state on purpose: a movement held by the stability
 * rules is not a failure the coordinator should retry, it is a decision they
 * can take anyway — so the reasons travel back and the control offers the
 * override in place.
 */
export type MunicipalityListEngagementLevelResponse =
  | {
      status: 'success'
      message: string
      // The level is never null here — a success is a movement TO a level.
      savedLevel: { level: EngagementLevel; note: string | null; changedAt: string | null }
    }
  | {
      status: 'blocked'
      message: string
      violations: EngagementLevelViolation[]
    }
  | {
      status: 'error'
      message: string
    }
