'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignQuickActionsFab } from '@/components/campaign/shell/CampaignQuickActionsFab'
import { CampaignQuickActionsOverlay } from '@/components/campaign/shell/CampaignQuickActionsOverlay'
import { shouldMountQuickActionsFab } from '@/lib/campaignQuickActionMount'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

export const CampaignContentScroll = ({ children }: { children: ReactNode }) => (
  <div
    data-slot="campaign-content-scroll"
    className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6 print:h-auto print:overflow-visible print:p-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
  >
    {children}
  </div>
)

export const CampaignQuickActionsHost = ({ role }: { role: CampaignRole }) => {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { context } = useCampaignQuickActionContext()

  const mounted = shouldMountQuickActionsFab(pathname, role)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
  }, [])

  if (!mounted) return null

  const actions = resolveQuickActionsForPath(pathname, role, context)
  const showBottomNav = isStaffCampaignRole(role)

  return (
    <>
      <CampaignQuickActionsFab
        open={open}
        onOpenChange={handleOpenChange}
        className={
          showBottomNav ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-4' : undefined
        }
      />
      <CampaignQuickActionsOverlay open={open} onOpenChange={handleOpenChange} actions={actions} />
    </>
  )
}

export const useQuickActionsChromeActive = (role: CampaignRole): boolean => {
  const pathname = usePathname()
  return shouldMountQuickActionsFab(pathname, role)
}
