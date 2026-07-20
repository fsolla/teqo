'use client'

import { createCampaignClientDynamic } from '@/components/campaign/CreateCampaignClientDynamic'
import type { NucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'

const DashboardMap = createCampaignClientDynamic<{ choropleth: NucleusChoroplethBundle }>(
  () => import('@/components/campaign/DashboardMap'),
  'DashboardMap',
  'h-[360px] lg:h-[min(28rem,50vh)]',
)

export const DashboardMapDynamic = ({ choropleth }: { choropleth: NucleusChoroplethBundle }) => (
  <DashboardMap choropleth={choropleth} />
)
