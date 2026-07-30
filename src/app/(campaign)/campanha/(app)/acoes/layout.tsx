import type { ReactNode } from 'react'

import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export default async function CampaignActionsLayout({ children }: { children: ReactNode }) {
  await requireCampaignPageActor({ gate: 'staff' })

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col" data-wizard-route>
      {children}
    </div>
  )
}
