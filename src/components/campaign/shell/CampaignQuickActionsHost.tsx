'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignQuickActionsDrawer } from '@/components/campaign/shell/CampaignQuickActionsDrawer'
import { useCampaignQuickActionsSnap } from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
import { useIsMobile } from '@/hooks/use-mobile'
import { shouldMountQuickActionsDrawer } from '@/lib/campaignQuickActionMount'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import {
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  quickActionsScrollDirection,
} from '@/lib/campaignQuickActionSnap'
import type { CampaignRole } from '@/lib/campaignRoles'
import { cn } from '@/lib/utils'

const CampaignContentScrollWithPeek = ({ children }: { children: ReactNode }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)
  const { isDock, setSnapPoint } = useCampaignQuickActionsSnap()
  const { uiFocused } = useHomeSearch()
  const peekHeight = isDock ? QUICK_ACTIONS_SNAP_DOCK : QUICK_ACTIONS_SNAP_COLLAPSED

  const syncSnapFromScroll = useCallback(() => {
    if (uiFocused) return

    const scrollport = scrollRef.current
    if (!scrollport) return

    const nextTop = scrollport.scrollTop
    const direction = quickActionsScrollDirection(lastScrollTopRef.current, nextTop)
    lastScrollTopRef.current = nextTop

    if (direction === 'down') {
      setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
      return
    }
    if (direction === 'up') {
      setSnapPoint(QUICK_ACTIONS_SNAP_DOCK)
    }
  }, [setSnapPoint, uiFocused])

  useEffect(() => {
    const scrollport = scrollRef.current
    if (!scrollport) return

    lastScrollTopRef.current = scrollport.scrollTop
    scrollport.addEventListener('scroll', syncSnapFromScroll, { passive: true })
    return () => {
      scrollport.removeEventListener('scroll', syncSnapFromScroll)
    }
  }, [syncSnapFromScroll])

  return (
    <div
      ref={scrollRef}
      data-slot="campaign-content-scroll"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:h-auto print:overflow-visible print:p-0',
        'pb-[calc(1rem+var(--campaign-quick-actions-peek))] md:pb-6',
      )}
      style={{ '--campaign-quick-actions-peek': peekHeight } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

export const CampaignContentScroll = ({
  children,
  quickActionsPeek,
}: {
  children: ReactNode
  quickActionsPeek: boolean
}) => {
  if (!quickActionsPeek) {
    return (
      <div
        data-slot="campaign-content-scroll"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:h-auto print:overflow-visible print:p-0"
      >
        {children}
      </div>
    )
  }

  return <CampaignContentScrollWithPeek>{children}</CampaignContentScrollWithPeek>
}

export const CampaignQuickActionsHost = ({ role }: { role: CampaignRole }) => {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { context } = useCampaignQuickActionContext()

  const mounted = isMobile && shouldMountQuickActionsDrawer(pathname, role)
  if (!mounted) return null

  const actions = resolveQuickActionsForPath(pathname, role, context)

  return <CampaignQuickActionsDrawer actions={actions} />
}

export const useQuickActionsChromeActive = (role: CampaignRole): boolean => {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  return isMobile && shouldMountQuickActionsDrawer(pathname, role)
}
