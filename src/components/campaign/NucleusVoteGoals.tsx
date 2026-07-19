import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/Progress'
import { formatElectionNumber } from '@/lib/electionInsights'
import type { NucleusPriority } from '@/lib/schemas/nucleus'
import { nucleusPriorityLabels } from '@/utilities/nucleusUi'
import { voteGoalProgressPercent, type VoteGoalsViewModel } from '@/utilities/voteGoals'

const formatGoal = (value: number | null): string =>
  value == null ? '—' : formatElectionNumber(value)

export const NucleusVoteGoals = ({
  voteGoals,
  confirmedVoteEstimate,
  priority,
}: {
  voteGoals: VoteGoalsViewModel
  confirmedVoteEstimate: number | null
  priority: NucleusPriority
}) => {
  const hasAnyGoal =
    voteGoals.good != null || voteGoals.regular != null || voteGoals.minimum != null
  const progressPercent = voteGoalProgressPercent(confirmedVoteEstimate, voteGoals.regular)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardDescription>Metas 2026</CardDescription>
          <CardTitle className="text-2xl">Cenários de votos</CardTitle>
        </div>
        {priority === 'alta' ? (
          <Badge variant="destructive" className="shrink-0">
            {nucleusPriorityLabels.alta}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasAnyGoal ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Bom</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatGoal(voteGoals.good)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Regular</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatGoal(voteGoals.regular)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Mínimo</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {formatGoal(voteGoals.minimum)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada para este núcleo.</p>
        )}

        {progressPercent != null ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>Estimativa confirmada vs. meta regular</span>
              <span className="font-medium tabular-nums">{progressPercent}%</span>
            </div>
            <Progress
              value={progressPercent}
              aria-label={`Progresso da estimativa confirmada em relação à meta regular: ${progressPercent}%`}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
