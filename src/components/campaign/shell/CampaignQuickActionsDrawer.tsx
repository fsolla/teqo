'use client'

import { useCallback, useEffect } from 'react'

import { CampaignGlobalSearchBody } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { useCampaignQuickActionsSnap } from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer'
import {
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  QUICK_ACTIONS_SNAP_POINTS,
  quickActionsSnapIsDock,
  type QuickActionsSnapPoint,
} from '@/lib/campaignQuickActionSnap'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { cn } from '@/lib/utils'

const SNAP_POINTS = [...QUICK_ACTIONS_SNAP_POINTS]

export const CampaignQuickActionsDrawer = ({
  actions,
}: {
  actions: readonly CampaignQuickAction[]
}) => {
  const { snapPoint, setSnapPoint, isDock } = useCampaignQuickActionsSnap()
  const { uiFocused } = useHomeSearch()
  const showActions = actions.length > 0

  const handleSnapPointChange = useCallback(
    (next: QuickActionsSnapPoint | string | number | null) => {
      if (next === QUICK_ACTIONS_SNAP_COLLAPSED || next === QUICK_ACTIONS_SNAP_DOCK) {
        setSnapPoint(next)
        return
      }
      setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
    },
    [setSnapPoint],
  )

  const toggleSnap = useCallback(() => {
    setSnapPoint((current) =>
      quickActionsSnapIsDock(current) ? QUICK_ACTIONS_SNAP_COLLAPSED : QUICK_ACTIONS_SNAP_DOCK,
    )
  }, [setSnapPoint])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
      }
    },
    [setSnapPoint],
  )

  // Active search focus keeps the drawer docked (B105) — same gate as scroll.
  useEffect(() => {
    if (uiFocused && !isDock) {
      setSnapPoint(QUICK_ACTIONS_SNAP_DOCK)
    }
  }, [isDock, setSnapPoint, uiFocused])

  return (
    <Drawer
      open
      modal={false}
      swipeDirection="down"
      snapPoints={SNAP_POINTS}
      snapPoint={snapPoint}
      onSnapPointChange={handleSnapPointChange}
      onOpenChange={handleOpenChange}
      disablePointerDismissal
    >
      <DrawerContent
        id="CampaignQuickActionsDrawer"
        className="border-t border-border bg-background text-foreground shadow-[0_-4px_24px_-8px_rgb(0_0_0/0.12)] print:hidden"
      >
        <DrawerTitle className="sr-only">Ações rápidas</DrawerTitle>
        <button
          type="button"
          onClick={toggleSnap}
          aria-expanded={isDock}
          aria-controls="quickActionContext"
          className="flex w-full shrink-0 cursor-grab flex-col items-center border-0 bg-transparent px-4 pt-2 pb-1 active:cursor-grabbing"
          aria-label={isDock ? 'Ocultar ações rápidas' : 'Mostrar ações rápidas'}
        >
          <span aria-hidden className="mb-1 block h-1 w-12 rounded-full bg-muted" />
        </button>
        <div
          id="quickActionContext"
          className={cn(
            'flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]',
            isDock ? 'flex-1' : 'shrink-0',
          )}
          data-snap={isDock ? 'dock' : 'collapsed'}
        >
          {showActions ? (
            <div hidden={!isDock} className="-mx-4 w-[calc(100%+2rem)]">
              <CampaignHomeActionStrip
                actions={actions.map((action) => ({
                  id: action.id,
                  label: action.label,
                  icon: action.icon,
                  description: action.description,
                  href: action.href,
                }))}
                className="w-full"
              />
            </div>
          ) : null}
          <CampaignGlobalSearchBody placeholder={isDock ? undefined : ''} showResults={isDock} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
