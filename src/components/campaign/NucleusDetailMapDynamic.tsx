'use client'

import { createCampaignClientDynamic } from '@/components/campaign/createCampaignClientDynamic'

const NucleusDetailMap = createCampaignClientDynamic<{
  codareas: string[]
  territoryCodes: string[]
  territoryLabel: string
}>(() => import('@/components/campaign/NucleusDetailMap'), 'NucleusDetailMap', 'h-[280px]')

export const NucleusDetailMapDynamic = ({
  codareas,
  territoryCodes,
  territoryLabel,
}: {
  codareas: string[]
  territoryCodes: string[]
  territoryLabel: string
}) => (
  <NucleusDetailMap
    codareas={codareas}
    territoryCodes={territoryCodes}
    territoryLabel={territoryLabel}
  />
)
