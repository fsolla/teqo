'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignQuickActionsFab } from '@/components/campaign/shell/CampaignQuickActionsFab'
import { CampaignQuickActionsOverlay } from '@/components/campaign/shell/CampaignQuickActionsOverlay'
import { shouldMountQuickActionsFab } from '@/lib/campaignQuickActionMount'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignContentScroll = ({ children }: { children: ReactNode }) => (
  <div
    data-slot="campaign-content-scroll"
    className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:h-auto print:overflow-visible print:p-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
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

  return (
    <>
      <CampaignQuickActionsFab open={open} onOpenChange={handleOpenChange} />
      <CampaignQuickActionsOverlay open={open} onOpenChange={handleOpenChange} actions={actions} />
    </>
  )
}

export const useQuickActionsChromeActive = (role: CampaignRole): boolean => {
  const pathname = usePathname()
  return shouldMountQuickActionsFab(pathname, role)
}
