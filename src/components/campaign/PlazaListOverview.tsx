import { CampaignMetricStrip } from '@/components/campaign/CampaignMetricStrip'
import { campaignPrioritySurfaceClassName } from '@/components/campaign/CampaignPageShell'
import type { PlazaListOverviewData } from '@/utilities/plazaPageData'

const voteFormatter = new Intl.NumberFormat('pt-BR')

export const PlazaListOverview = ({ view }: { view: PlazaListOverviewData }) => (
  <section
    aria-label="Visão geral das Praças filtradas"
    className={`rounded-xl ${campaignPrioritySurfaceClassName}`}
  >
    <CampaignMetricStrip
      metrics={[
        {
          label: 'Votos estimados no conjunto',
          value: view.pledgeCount ? voteFormatter.format(view.effectiveVotesTotal) : '—',
          emphasize: true,
        },
        {
          label: 'Declarações de votos',
          value: view.pledgeCount
            ? `${voteFormatter.format(view.pledgeCount)}${
                view.missingEstimateCount
                  ? ` · ${voteFormatter.format(view.missingEstimateCount)} sem estimativa`
                  : ''
              }`
            : 'Nenhuma',
        },
        {
          label: 'Cobertura de assessoria',
          value: `${view.withAdvisorCount} de ${view.plazaCount} Praças`,
          progress:
            view.plazaCount > 0
              ? Math.round((view.withAdvisorCount / view.plazaCount) * 100)
              : undefined,
        },
      ]}
    />
  </section>
)
