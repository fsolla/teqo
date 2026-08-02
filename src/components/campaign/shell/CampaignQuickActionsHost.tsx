'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignQuickActionsFab } from '@/components/campaign/shell/CampaignQuickActionsFab'
import { CampaignQuickActionsOverlay } from '@/components/campaign/shell/CampaignQuickActionsOverlay'
import { shouldMountQuickActionsFab } from '@/lib/campaignQuickActionMount'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import type { CampaignRole } from '@/lib/campaignRoles'

export const CampaignContentScroll = ({ children }: { children: ReactNode }) => (
  <div
    data-slot="campaign-content-scroll"
    className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:h-auto print:overflow-visible print:p-0"
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

  if (!mounted) return null

  const actions = resolveQuickActionsForPath(pathname, role, context)

  return (
    <>
      <CampaignQuickActionsFab open={open} onOpenChange={setOpen} />
      <CampaignQuickActionsOverlay open={open} onOpenChange={setOpen} actions={actions} />
    </>
  )
}

export const useQuickActionsChromeActive = (role: CampaignRole): boolean => {
  const pathname = usePathname()
  return shouldMountQuickActionsFab(pathname, role)
}
