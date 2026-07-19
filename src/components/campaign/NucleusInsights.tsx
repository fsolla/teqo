import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2Icon,
  Link2Icon,
  MegaphoneIcon,
  MinusIcon,
  PercentIcon,
  ShieldIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  computeConversionRate,
  computeGapVs2022,
  computeTerritorialClass,
  computeTicketLeverage,
  computeVoteTrend,
  conversionRateAlertVariant,
  formatElectionNumber,
  formatVoteTrendSeries,
  isComparableConversionBand,
  isComparableTerritorialClass,
  isComparableTicketLeverage,
  territorialClassAlertVariant,
  territorialClassBadgeVariant,
  territorialClassLabel,
  ticketLeverageAlertVariant,
  voteTrendAlertVariant,
  type ComparableTerritorialClass,
} from '@/lib/electionInsights'
import { cn } from '@/lib/utils'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

const confirmedInsightAlertClass =
  'border-[color:var(--estimate-confirmed)] bg-[color:var(--estimate-confirmed)] text-[color:var(--estimate-confirmed-foreground)] *:data-[slot=alert-description]:text-[color:var(--estimate-confirmed-foreground)]'

const TERRITORIAL_CLASS_ICON: Record<ComparableTerritorialClass, LucideIcon> = {
  defesa: ShieldIcon,
  ataque: TriangleAlertIcon,
  indecisa: MinusIcon,
  perdida: TrendingDownIcon,
}

const TerritorialClassIcon = ({ band }: { band: ComparableTerritorialClass }) => {
  const Icon = TERRITORIAL_CLASS_ICON[band]
  return <Icon aria-hidden="true" />
}

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

  const leverage = computeTicketLeverage({
    confirmedVoteEstimate,
    presidentVotes: baseline?.president?.votes ?? null,
    governorVotes: baseline?.governor?.votes ?? null,
  })
  const LeverageIcon =
    leverage.status === 'comparable' && (leverage.headlinePercent ?? 0) >= 100
      ? CheckCircle2Icon
      : Link2Icon

  const flip = baseline?.ticketFlip ?? null

  const territorial = computeTerritorialClass({
    sollaVotes: baseline?.candidate.votes ?? 0,
    federalValidVotes: baseline?.electorate.validos ?? null,
  })

  let supportLine: string | null = null
  if ((gap.status === 'above' || gap.status === 'below') && baseline && confirmedVoteEstimate !== null) {
    supportLine = `Estimativa atual (${formatElectionNumber(confirmedVoteEstimate)}) · resultado 2022 (${formatElectionNumber(baseline.candidate.votes)})`
  }

  const showConversion = isComparableConversionBand(conversion.band)
  const showLeverage = isComparableTicketLeverage(leverage.status)
  const showFlip = flip?.status === 'opportunity'

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

      {showLeverage ? (
        <Alert
          data-insight="ticket-leverage"
          variant={ticketLeverageAlertVariant(leverage)}
          className={cn(
            'rounded-xl px-3.5 py-3',
            (leverage.headlinePercent ?? 0) >= 100 && confirmedInsightAlertClass,
          )}
        >
          <LeverageIcon aria-hidden="true" />
          <AlertTitle className="font-bold">{leverage.message}</AlertTitle>
          {leverage.supportLine ? <AlertDescription>{leverage.supportLine}</AlertDescription> : null}
        </Alert>
      ) : null}

      {showFlip ? (
        <Alert
          data-insight="ticket-flip"
          variant="pending"
          className="rounded-xl px-3.5 py-3"
        >
          <MegaphoneIcon aria-hidden="true" />
          <AlertTitle className="font-bold">{flip.message}</AlertTitle>
          {flip.supportLine ? <AlertDescription>{flip.supportLine}</AlertDescription> : null}
        </Alert>
      ) : null}

      {isComparableTerritorialClass(territorial.band) ? (
        <Alert
          data-insight="territorial-class"
          variant={territorialClassAlertVariant(territorial.band)}
          className={cn(
            'rounded-xl px-3.5 py-3',
            territorial.band === 'defesa' && confirmedInsightAlertClass,
          )}
        >
          <TerritorialClassIcon band={territorial.band} />
          <AlertTitle className="flex items-start justify-between gap-2 font-bold">
            <span>{territorial.title}</span>
            <Badge
              className="shrink-0"
              variant={territorialClassBadgeVariant(territorial.band)}
            >
              {territorialClassLabel(territorial.band)}
            </Badge>
          </AlertTitle>
          <AlertDescription>{territorial.priorityLine}</AlertDescription>
          {territorial.supportLine ? (
            <AlertDescription>{territorial.supportLine}</AlertDescription>
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
