'use client'

import { createCampaignClientDynamic } from '@/components/campaign/createCampaignClientDynamic'
import type { NucleusChoroplethBundle } from '@/utilities/nucleusChoroplethTypes'

const DashboardMap = createCampaignClientDynamic<{ choropleth: NucleusChoroplethBundle }>(
  () => import('@/components/campaign/DashboardMap'),
  'DashboardMap',
  'h-[360px]',
)

export const DashboardMapDynamic = ({ choropleth }: { choropleth: NucleusChoroplethBundle }) => (
  <DashboardMap choropleth={choropleth} />
)
