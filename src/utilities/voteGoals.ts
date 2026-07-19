export type VoteGoalsFields = {
  good?: number | null
  regular?: number | null
  minimum?: number | null
}

export type VoteGoalsViewModel = {
  good: number | null
  regular: number | null
  minimum: number | null
}

export type VoteGoalsSumViewModel = {
  good: number
  regular: number
  minimum: number
}

export type VoteGoalsAggregate = VoteGoalsSumViewModel & {
  highPriorityCount: number
}

export const VOTE_GOALS_ORDER_ERROR_MESSAGE =
  'As metas devem seguir a ordem Bom ≥ Regular ≥ Mínimo quando informadas.'

export type VoteGoalScenarioKey = keyof VoteGoalsFields

/** Returns the scenario key that breaks Bom ≥ Regular ≥ Mínimo, if any. */
export const getVoteGoalsOrderViolation = (
  voteGoals: VoteGoalsFields | null | undefined,
): VoteGoalScenarioKey | null => {
  if (!voteGoals) return null

  const ordered = (
    [
      ['good', voteGoals.good],
      ['regular', voteGoals.regular],
      ['minimum', voteGoals.minimum],
    ] as const
  ).filter((entry): entry is [VoteGoalScenarioKey, number] => entry[1] != null)

  for (let index = 1; index < ordered.length; index += 1) {
    const [, previous] = ordered[index - 1]!
    const [key, current] = ordered[index]!
    if (previous < current) return key
  }

  return null
}

export const toVoteGoalsViewModel = (voteGoals?: VoteGoalsFields | null): VoteGoalsViewModel => ({
  good: voteGoals?.good ?? null,
  regular: voteGoals?.regular ?? null,
  minimum: voteGoals?.minimum ?? null,
})

export const voteGoalProgressPercent = (
  confirmed: number | null,
  regular: number | null,
): number | null => {
  if (confirmed == null || regular == null || regular <= 0) return null
  return Math.min(100, Math.round((confirmed / regular) * 100))
}

export const aggregateVoteGoals = (
  nuclei: Array<{
    voteGoals: VoteGoalsViewModel
    priority?: 'alta' | 'normal' | null
  }>,
): VoteGoalsAggregate => {
  const totals: VoteGoalsSumViewModel = { good: 0, regular: 0, minimum: 0 }
  let highPriorityCount = 0

  for (const nucleus of nuclei) {
    totals.good += nucleus.voteGoals.good ?? 0
    totals.regular += nucleus.voteGoals.regular ?? 0
    totals.minimum += nucleus.voteGoals.minimum ?? 0
    if (nucleus.priority === 'alta') highPriorityCount += 1
  }

  return { ...totals, highPriorityCount }
}

export const sumVoteGoals = (
  nuclei: Array<{ voteGoals: VoteGoalsViewModel }>,
): VoteGoalsSumViewModel => {
  const { good, regular, minimum } = aggregateVoteGoals(nuclei)
  return { good, regular, minimum }
}

export const countHighPriorityNuclei = (
  nuclei: Array<{ priority: 'alta' | 'normal' | null }>,
): number => nuclei.reduce((count, { priority }) => count + (priority === 'alta' ? 1 : 0), 0)
