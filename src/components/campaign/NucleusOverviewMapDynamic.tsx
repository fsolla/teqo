'use client'

import { createCampaignClientDynamic } from '@/components/campaign/createCampaignClientDynamic'
import type { NucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'

const NucleusOverviewMap = createCampaignClientDynamic<{ choropleth: NucleusChoroplethBundle }>(
  () => import('@/components/campaign/NucleusOverviewMap'),
  'NucleusOverviewMap',
  'h-[360px]',
)

export const NucleusOverviewMapDynamic = ({
  choropleth,
}: {
  choropleth: NucleusChoroplethBundle
}) => <NucleusOverviewMap choropleth={choropleth} />
