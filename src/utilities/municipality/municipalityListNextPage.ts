/**
 * B161 — wire type of the municípios next-page server action. Own module so
 * the client list and the server action share it without an import cycle
 * (the list value-imports the action; the action type-imports this).
 */
import type {
  MunicipalityAdvisorSummary,
  MunicipalityLeadershipSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'

export type MunicipalityListNextPageResult =
  | {
      status: 'ok'
      rows: readonly MunicipalityListViewModel[]
      leadershipSummaries: readonly MunicipalityLeadershipSummary[]
      advisorSummaries: readonly MunicipalityAdvisorSummary[]
      totalDocs: number
      hasMore: boolean
    }
  | { status: 'error'; message: string }
