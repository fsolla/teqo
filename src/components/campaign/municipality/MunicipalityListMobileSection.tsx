'use client'

import type { MunicipalityListMobileCardsProps } from '@/components/campaign/municipality/MunicipalityListMobileCards'
import { MunicipalityListMobileCards } from '@/components/campaign/municipality/MunicipalityListMobileCards'
import { CampaignListSheetProvider } from '@/components/campaign/shared/CampaignListSheetHost'

type MunicipalityListMobileSectionProps = MunicipalityListMobileCardsProps

/** Mobile cards (`md:hidden`) with one shared bottom sheet for all quick edits. */
export const MunicipalityListMobileSection = (props: MunicipalityListMobileSectionProps) => (
  <CampaignListSheetProvider>
    <MunicipalityListMobileCards {...props} />
  </CampaignListSheetProvider>
)
