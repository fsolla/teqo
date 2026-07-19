import { ChartColumnIcon, TrendingDownIcon, TrendingUpIcon, TrophyIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  computeVoteTrend,
  formatElectionNumber,
  formatVoteTrendSeriesCompact,
  NO_ELECTION_BASELINE_MESSAGE,
  voteTrendBadgeVariant,
  voteTrendStatusLabel,
} from '@/lib/electionInsights'
import { BASELINE_TICKET_2022 } from '@/lib/electionResults'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

const ticket = BASELINE_TICKET_2022

const barPercent = (votes: number, scale: number): number => {
  if (scale <= 0 || votes <= 0) return 0
  return Math.min(100, Math.round((votes / scale) * 100))
}

export const NucleusElectoralBaseline = ({
  baseline,
}: {
  baseline: NucleusElectoralBaselineViewModel | null
}) => {
  if (!baseline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartColumnIcon aria-hidden="true" className="size-4 text-primary" />
            Baseline eleitoral 2022
          </CardTitle>
          <CardDescription>Deputado Federal · Bahia</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{NO_ELECTION_BASELINE_MESSAGE}</p>
        </CardContent>
      </Card>
    )
  }

  const scale = Math.max(
    baseline.electorate.validos,
    baseline.candidate.votes,
    baseline.winnerFederal?.votes ?? 0,
    1,
  )
  const candidateBar = barPercent(baseline.candidate.votes, scale)
  const trend = computeVoteTrend(baseline.series)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ChartColumnIcon aria-hidden="true" className="size-4 text-primary" />
            Baseline eleitoral 2022
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {trend.status !== 'noBaseline' ? (
              <Badge variant={voteTrendBadgeVariant(trend.status)}>
                {trend.status === 'increase' ? (
                  <TrendingUpIcon aria-hidden="true" className="size-3" />
                ) : trend.status === 'decline' ? (
                  <TrendingDownIcon aria-hidden="true" className="size-3" />
                ) : null}
                {voteTrendStatusLabel(trend.status)}
              </Badge>
            ) : null}
            <CardDescription>Deputado Federal · Bahia</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <div className="border-l-4 border-primary bg-primary/5 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{ticket.candidate.name}</p>
                <p className="text-xs font-semibold text-primary">
                  {ticket.candidate.party} · {ticket.candidate.officeLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold tabular-nums text-primary">
                  {formatElectionNumber(baseline.candidate.votes)}
                </p>
                <p className="text-xs text-muted-foreground">votos · 2022</p>
              </div>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/20"
              role="progressbar"
              aria-valuenow={candidateBar}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Participação de ${ticket.candidate.name}: ${candidateBar}%`}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${candidateBar}%` }}
              />
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Série histórica
            </p>
            <p className="text-sm tabular-nums">{formatVoteTrendSeriesCompact(baseline.series)}</p>
            {trend.status !== 'noBaseline' ? (
              <p className="mt-1 text-xs text-muted-foreground">{trend.message}</p>
            ) : null}
          </div>

          {baseline.president ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{ticket.president.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.president.party} · Presidente (
                  {baseline.president.turn === 2 ? '2º turno' : '1º turno'})
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {formatElectionNumber(baseline.president.votes)}
              </p>
            </div>
          ) : null}

          {baseline.governor ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{ticket.governor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.governor.party} · Governador (
                  {baseline.governor.turn === 2 ? '2º turno' : '1º turno'})
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {formatElectionNumber(baseline.governor.votes)}
              </p>
            </div>
          ) : null}

          <div className="bg-muted/40 px-4 py-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Eleitorado 2022
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Votos válidos</span>
                <span className="text-xs font-bold tabular-nums">
                  {formatElectionNumber(baseline.electorate.validos)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Brancos</span>
                <span className="text-xs font-bold tabular-nums">
                  {formatElectionNumber(baseline.electorate.brancos)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Nulos</span>
                <span className="text-xs font-bold tabular-nums">
                  {formatElectionNumber(baseline.electorate.nulos)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Abstenções</span>
                <span className="text-xs font-bold tabular-nums">
                  {formatElectionNumber(baseline.electorate.abstencoes)}
                </span>
              </div>
            </div>
          </div>

          {baseline.winnerFederal ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-start gap-2">
                <TrophyIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[color:var(--estimate-pending-foreground)]"
                />
                <div>
                  <p className="text-xs text-muted-foreground">Mais votado aqui em 2022</p>
                  <p className="text-sm font-semibold">
                    {baseline.winnerFederal.name} ({baseline.winnerFederal.party})
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {formatElectionNumber(baseline.winnerFederal.votes)}
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
