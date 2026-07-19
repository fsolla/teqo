import {
  CheckCircle2Icon,
  MinusIcon,
  PercentIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import {
  computeConversionRate,
  computeGapVs2022,
  computeVoteTrend,
  conversionRateAlertVariant,
  formatElectionNumber,
  formatVoteTrendSeries,
  isComparableConversionBand,
  voteTrendAlertVariant,
} from '@/lib/electionInsights'
import { cn } from '@/lib/utils'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

const confirmedInsightAlertClass =
  'border-[color:var(--estimate-confirmed)] bg-[color:var(--estimate-confirmed)] text-[color:var(--estimate-confirmed-foreground)] *:data-[slot=alert-description]:text-[color:var(--estimate-confirmed-foreground)]'

export const NucleusInsights = ({
  baseline,
  confirmedVoteEstimate,
}: {
  baseline: NucleusElectoralBaselineViewModel | null
  confirmedVoteEstimate: number | null
}) => {
  const gap = computeGapVs2022(baseline, confirmedVoteEstimate)
  const GapIcon = gap.status === 'above' ? CheckCircle2Icon : TriangleAlertIcon

  const trend = baseline ? computeVoteTrend(baseline.series) : null
  const TrendIcon =
    trend?.status === 'increase'
      ? TrendingUpIcon
      : trend?.status === 'decline'
        ? TrendingDownIcon
        : trend?.status === 'stable'
          ? MinusIcon
          : TriangleAlertIcon

  const conversion = computeConversionRate({
    aptos: baseline?.electorate.aptos ?? null,
    abstencoes: baseline?.electorate.abstencoes ?? null,
    confirmedVoteEstimate,
  })
  const ConversionIcon =
    conversion.band === 'reduto'
      ? CheckCircle2Icon
      : conversion.band === 'oportunidade'
        ? TriangleAlertIcon
        : PercentIcon

  let supportLine: string | null = null
  if ((gap.status === 'above' || gap.status === 'below') && baseline && confirmedVoteEstimate !== null) {
    supportLine = `Estimativa atual (${formatElectionNumber(confirmedVoteEstimate)}) · resultado 2022 (${formatElectionNumber(baseline.candidate.votes)})`
  }

  const showConversion = isComparableConversionBand(conversion.band)

  return (
    <section aria-labelledby="nucleus-insights-heading" className="flex flex-col gap-3">
      <h3 id="nucleus-insights-heading" className="sr-only">
        Insights do território
      </h3>
      <Alert
        data-insight="gap-vs-2022"
        variant={gap.status === 'above' ? 'default' : 'pending'}
        className={cn('rounded-xl px-3.5 py-3', gap.status === 'above' && confirmedInsightAlertClass)}
      >
        <GapIcon aria-hidden="true" />
        <AlertTitle className="font-bold">{gap.message}</AlertTitle>
        {supportLine ? <AlertDescription>{supportLine}</AlertDescription> : null}
      </Alert>

      {showConversion ? (
        <Alert
          data-insight="conversion-rate"
          variant={conversionRateAlertVariant(conversion.band)}
          className={cn(
            'rounded-xl px-3.5 py-3',
            conversion.band === 'reduto' && confirmedInsightAlertClass,
          )}
        >
          <ConversionIcon aria-hidden="true" />
          <AlertTitle className="font-bold">{conversion.message}</AlertTitle>
          {conversion.supportLine ? (
            <AlertDescription>{conversion.supportLine}</AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      {baseline && trend && trend.status !== 'noBaseline' ? (
        <Alert
          data-insight="vote-trend"
          variant={voteTrendAlertVariant(trend.status)}
          className={cn(
            'rounded-xl px-3.5 py-3',
            trend.status === 'increase' && confirmedInsightAlertClass,
          )}
        >
          <TrendIcon aria-hidden="true" />
          <AlertTitle className="font-bold">Tendência: {trend.message}</AlertTitle>
          <AlertDescription>Série {formatVoteTrendSeries(baseline.series)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
