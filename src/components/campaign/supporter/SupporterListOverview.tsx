import { CampaignDataFreshness } from '@/components/campaign/dashboard/CampaignDataFreshness'
import { CampaignMetricStrip } from '@/components/campaign/shared/CampaignMetricStrip'
import type { SupporterListOverviewViewModel } from '@/utilities/supporterViewModels'

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const SupporterListOverview = ({
  view,
  now,
}: {
  view: SupporterListOverviewViewModel
  now: Date
}) => (
  <section aria-labelledby="supporter-list-overview" className="flex flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="supporter-list-overview" className="sr-only">
        Indicadores dos apoiadores filtrados
      </h2>
      <CampaignDataFreshness asOf={now} />
    </div>
    <CampaignMetricStrip
      metrics={[
        {
          label: 'Total',
          value: numberFormatter.format(view.total),
        },
        {
          label: 'Certo + Tende',
          value: numberFormatter.format(view.certoAndTende),
          emphasize: true,
        },
        {
          label: 'Indecisos',
          value: numberFormatter.format(view.indeciso),
        },
      ]}
    />
  </section>
)
