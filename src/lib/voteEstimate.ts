import { formatElectionNumber } from '@/lib/electionFormat'

export const VOTE_ESTIMATE_SCENARIOS = ['pessimistic', 'central', 'optimistic'] as const

export type VoteEstimateScenario = (typeof VOTE_ESTIMATE_SCENARIOS)[number]

export const DEFAULT_VOTE_ESTIMATE_SCENARIO: VoteEstimateScenario = 'central'

export type VoteEstimateScenarioFields = {
  pessimistic?: number | null
  central?: number | null
  optimistic?: number | null
}

export type VoteEstimateScenarioViewModel = {
  pessimistic: number | null
  central: number | null
  optimistic: number | null
}

/** Fresh zeroed record per scenario — a factory because callers accumulate into it. */
export const zeroByVoteEstimateScenario = (): Record<VoteEstimateScenario, number> => ({
  pessimistic: 0,
  central: 0,
  optimistic: 0,
})

export const voteEstimateScenarioLabels: Record<VoteEstimateScenario, string> = {
  pessimistic: 'Pessimista',
  central: 'Média',
  optimistic: 'Otimista',
}

export const VOTE_ESTIMATE_ORDER_ERROR_MESSAGE =
  'As estimativas devem seguir a ordem Pessimista ≤ Média ≤ Otimista quando informadas.'

/** Returns the scenario key that breaks pessimistic ≤ central ≤ optimistic, if any. */
export const getVoteEstimateOrderViolation = (
  estimates: VoteEstimateScenarioFields | null | undefined,
): VoteEstimateScenario | null => {
  if (!estimates) return null

  const ordered = (
    [
      ['pessimistic', estimates.pessimistic],
      ['central', estimates.central],
      ['optimistic', estimates.optimistic],
    ] as const
  ).filter((entry): entry is [VoteEstimateScenario, number] => entry[1] != null)

  for (let index = 1; index < ordered.length; index += 1) {
    const [, previous] = ordered[index - 1]!
    const [key, current] = ordered[index]!
    if (previous > current) return key
  }

  return null
}

export const voteEstimatesEqual = (
  left: VoteEstimateScenarioViewModel,
  right: VoteEstimateScenarioViewModel,
): boolean =>
  left.pessimistic === right.pessimistic &&
  left.central === right.central &&
  left.optimistic === right.optimistic

export const toVoteEstimateScenarioViewModel = (
  estimates?: VoteEstimateScenarioFields | null,
): VoteEstimateScenarioViewModel => ({
  pessimistic: estimates?.pessimistic ?? null,
  central: estimates?.central ?? null,
  optimistic: estimates?.optimistic ?? null,
})

export const getVoteEstimateForScenario = (
  estimates: VoteEstimateScenarioFields | null | undefined,
  scenario: VoteEstimateScenario,
): number | null => estimates?.[scenario] ?? null

/** Effective staff votes for one pledge in a scenario: estimated[S] ?? declared. */
export const effectivePledgeVotesForScenario = (
  declaredVotes: number,
  estimatedVotes: VoteEstimateScenarioFields | null | undefined,
  scenario: VoteEstimateScenario,
): number => getVoteEstimateForScenario(estimatedVotes, scenario) ?? declaredVotes

/** Staff municipality total for one scenario: expected[S] ?? pledge aggregate for S. */
export const resolveMunicipalityStaffVoteTotalForScenario = (
  expectedVotes: VoteEstimateScenarioFields | null | undefined,
  pledgeEffectiveTotal: number,
  scenario: VoteEstimateScenario = DEFAULT_VOTE_ESTIMATE_SCENARIO,
): number => getVoteEstimateForScenario(expectedVotes, scenario) ?? pledgeEffectiveTotal

export const formatVoteEstimateRange = (
  estimates: VoteEstimateScenarioViewModel,
): string | null => {
  const { pessimistic, optimistic } = estimates
  if (pessimistic == null || optimistic == null) return null
  return `${formatElectionNumber(pessimistic)}–${formatElectionNumber(optimistic)}`
}

/** Staff-facing endpoints label: "Pessimista 1.200 · Otimista 1.800". */
export const formatVoteEstimateEndpointsLabel = (
  estimates: VoteEstimateScenarioViewModel | Record<VoteEstimateScenario, number>,
): string | null => {
  const pessimistic = estimates.pessimistic
  const optimistic = estimates.optimistic
  if (pessimistic == null || optimistic == null) return null
  return `${voteEstimateScenarioLabels.pessimistic} ${formatElectionNumber(pessimistic)} · ${voteEstimateScenarioLabels.optimistic} ${formatElectionNumber(optimistic)}`
}

export const hasAnyVoteEstimate = (
  estimates: VoteEstimateScenarioViewModel | Record<VoteEstimateScenario, number>,
): boolean =>
  estimates.pessimistic != null || estimates.central != null || estimates.optimistic != null

export const formatVoteEstimateScenarioAriaLabel = (
  estimates: VoteEstimateScenarioViewModel,
): string =>
  VOTE_ESTIMATE_SCENARIOS.map((scenario) => {
    const value = estimates[scenario]
    return `${voteEstimateScenarioLabels[scenario]}: ${
      value == null ? 'não informado' : formatElectionNumber(value)
    }`
  }).join('; ')

/** Coerce staff-entered scenarios into pessimistic ≤ central ≤ optimistic on save. */
export const normalizeVoteEstimateOnSave = (
  estimates: VoteEstimateScenarioViewModel,
): VoteEstimateScenarioViewModel => {
  const pessimistic = estimates.pessimistic
  let central = estimates.central
  let optimistic = estimates.optimistic

  if (pessimistic != null && central != null && pessimistic > central) {
    central = pessimistic
  }
  if (optimistic != null && central != null && optimistic < central) {
    central = optimistic
  }
  if (pessimistic != null && optimistic != null && pessimistic > optimistic) {
    optimistic = pessimistic
    if (central != null && central < pessimistic) {
      central = pessimistic
    }
  }

  return { pessimistic, central, optimistic }
}
