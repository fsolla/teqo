import type { ReactNode } from 'react'

import { CardDescription, CardHeader } from '@/components/ui/card'
import {
  campaignAuthCardHeaderClassName,
  campaignAuthDescriptionClassName,
  campaignAuthHeadingClassName,
} from '@/lib/campaignAuthCopy'

type CampaignAuthCardHeaderProps = {
  title: string
  description: ReactNode
}

export const CampaignAuthCardHeader = ({ title, description }: CampaignAuthCardHeaderProps) => (
  <CardHeader className={campaignAuthCardHeaderClassName}>
    <h1 className={campaignAuthHeadingClassName}>{title}</h1>
    <CardDescription className={campaignAuthDescriptionClassName}>{description}</CardDescription>
  </CardHeader>
)
