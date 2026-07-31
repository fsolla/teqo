'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { CampaignQuickActionsDrawer } from '@/components/campaign/shell/CampaignQuickActionsDrawer'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { useIsMobile } from '@/hooks/use-mobile'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import { shouldMountQuickActionsDrawer } from '@/lib/campaignQuickActionMount'
import { QUICK_ACTIONS_SNAP_COLLAPSED } from '@/lib/campaignQuickActionSnap'
import type { CampaignRole } from '@/lib/campaignRoles'
import { cn } from '@/lib/utils'

export const CampaignContentScroll = ({
  children,
  quickActionsPeek,
}: {
  children: ReactNode
  quickActionsPeek: boolean
}) => (
  <div
    data-slot="campaign-content-scroll"
    className={cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:h-auto print:overflow-visible print:p-0',
      quickActionsPeek && 'pb-[calc(1rem+var(--campaign-quick-actions-peek))] md:pb-6',
    )}
    style={
      quickActionsPeek
        ? ({ '--campaign-quick-actions-peek': QUICK_ACTIONS_SNAP_COLLAPSED } as React.CSSProperties)
        : undefined
    }
  >
    {children}
  </div>
)

export const CampaignQuickActionsHost = ({ role }: { role: CampaignRole }) => {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { context } = useCampaignQuickActionContext()

  const mounted = isMobile && shouldMountQuickActionsDrawer(pathname, role)
  if (!mounted) return null

  const actions = resolveQuickActionsForPath(pathname, role, context)

  return <CampaignQuickActionsDrawer role={role} actions={actions} />
}

export const useQuickActionsChromeActive = (role: CampaignRole): boolean => {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  return isMobile && shouldMountQuickActionsDrawer(pathname, role)
}
