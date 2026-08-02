'use client'

import { usePathname } from 'next/navigation'

import {
  useCampaignPageChromeOverride,
  useCampaignPageChromeRole,
} from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageChromeText } from '@/components/campaign/shell/CampaignPageChromeText'
import { resolveCampaignPageChrome } from '@/lib/campaignPageChrome'

export const useEffectiveCampaignPageChrome = () => {
  const pathname = usePathname()
  const role = useCampaignPageChromeRole()
  const override = useCampaignPageChromeOverride()

  return override ?? resolveCampaignPageChrome(pathname, role)
}

export const CampaignPageChromeDisplay = ({
  layout,
  className,
}: {
  layout: 'mobile' | 'desktop'
  className?: string
}) => {
  const chrome = useEffectiveCampaignPageChrome()

  if (!chrome) return null

  return <CampaignPageChromeText chrome={chrome} layout={layout} className={className} />
}
