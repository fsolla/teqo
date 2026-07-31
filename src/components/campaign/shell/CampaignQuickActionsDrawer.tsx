'use client'

import { useCallback, useState } from 'react'

import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from '@/components/ui/Drawer'
import type { ResolvedCampaignHomeAction } from '@/lib/campaignHomeActions'
import {
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_EXPANDED,
  QUICK_ACTIONS_SNAP_POINTS,
  quickActionsSnapIsExpanded,
  type QuickActionsSnapPoint,
} from '@/lib/campaignQuickActionSnap'
import { cn } from '@/lib/utils'

const SNAP_POINTS = [...QUICK_ACTIONS_SNAP_POINTS]

export const CampaignQuickActionsDrawer = ({
  actions,
}: {
  actions: readonly ResolvedCampaignHomeAction[]
}) => {
  const [snapPoint, setSnapPoint] = useState<QuickActionsSnapPoint | null>(
    QUICK_ACTIONS_SNAP_COLLAPSED,
  )
  const expanded = quickActionsSnapIsExpanded(snapPoint)
  const showActions = actions.length > 0

  const handleSnapPointChange = useCallback((next: QuickActionsSnapPoint | string | number | null) => {
    if (next === QUICK_ACTIONS_SNAP_COLLAPSED || next === QUICK_ACTIONS_SNAP_EXPANDED) {
      setSnapPoint(next)
      return
    }
    setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
  }, [])

  const toggleSnap = useCallback(() => {
    setSnapPoint((current) =>
      quickActionsSnapIsExpanded(current) ? QUICK_ACTIONS_SNAP_COLLAPSED : QUICK_ACTIONS_SNAP_EXPANDED,
    )
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
    }
  }, [])

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
        className={cn(
          'border-t border-border bg-background text-foreground shadow-[0_-4px_24px_-8px_rgb(0_0_0/0.12)] print:hidden',
          !expanded && 'pointer-events-auto',
        )}
      >
        <DrawerTitle className="sr-only">Ações rápidas</DrawerTitle>
        <button
          type="button"
          onClick={toggleSnap}
          aria-expanded={expanded}
          aria-controls="quickActionContext"
          className="flex w-full shrink-0 cursor-grab flex-col items-center border-0 bg-transparent px-4 pt-2 pb-1 active:cursor-grabbing"
          aria-label={expanded ? 'Ocultar ações rápidas' : 'Mostrar ações rápidas'}
        >
          <span aria-hidden className="mb-1 block h-1 w-12 rounded-full bg-muted" />
        </button>
        <div
          id="quickActionContext"
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
            !expanded && 'hidden',
          )}
          data-snap={expanded ? 'expanded' : 'collapsed'}
        >
          {showActions ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma ação rápida nesta página.</p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
