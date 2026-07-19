import { CheckCircle2Icon, TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { computeGapVs2022, formatElectionNumber } from '@/lib/electionInsights'
import { cn } from '@/lib/utils'
import type { NucleusElectoralBaselineViewModel } from '@/utilities/nucleusViewModels'

export const NucleusInsights = ({
  baseline,
  confirmedVoteEstimate,
}: {
  baseline: NucleusElectoralBaselineViewModel | null
  confirmedVoteEstimate: number | null
}) => {
  const gap = computeGapVs2022(baseline, confirmedVoteEstimate)
  const Icon = gap.status === 'above' ? CheckCircle2Icon : TriangleAlertIcon

  let supportLine: string | null = null
  if ((gap.status === 'above' || gap.status === 'below') && baseline && confirmedVoteEstimate !== null) {
    supportLine = `Estimativa atual (${formatElectionNumber(confirmedVoteEstimate)}) · resultado 2022 (${formatElectionNumber(baseline.candidate.votes)})`
  }

  return (
    <section aria-labelledby="nucleus-insights-heading" className="flex flex-col gap-3">
      <h3 id="nucleus-insights-heading" className="sr-only">
        Insights do território
      </h3>
      <Alert
        data-insight="gap-vs-2022"
        variant={gap.status === 'above' ? 'default' : 'pending'}
        className={cn(
          'rounded-xl px-3.5 py-3',
          gap.status === 'above' &&
            'border-[color:var(--estimate-confirmed)] bg-[color:var(--estimate-confirmed)] text-[color:var(--estimate-confirmed-foreground)] *:data-[slot=alert-description]:text-[color:var(--estimate-confirmed-foreground)]',
        )}
      >
        <Icon aria-hidden="true" />
        <AlertTitle className="font-bold">{gap.message}</AlertTitle>
        {supportLine ? <AlertDescription>{supportLine}</AlertDescription> : null}
      </Alert>
    </section>
  )
}
