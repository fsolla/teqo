'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect } from 'react'

import { CampaignGlobalSearchBody } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { HomeSearchExcludeProvider } from '@/components/campaign/dashboard/HomeSearchExcludeContext'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { useCampaignQuickActionsSnap } from '@/components/campaign/shell/CampaignQuickActionsSnapContext'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer'
import {
  QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX,
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  QUICK_ACTIONS_SNAP_FULL,
  QUICK_ACTIONS_SNAP_POINTS,
  quickActionsSnapIsDock,
  quickActionsSnapIsFull,
  type QuickActionsSnapPoint,
} from '@/lib/campaignQuickActionSnap'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { resolveHomeSearchExcludeContext } from '@/lib/homeSearchExcludeCurrentEntity'
import { cn } from '@/lib/utils'

const SNAP_POINTS = [...QUICK_ACTIONS_SNAP_POINTS]

const restoreSnapAfterSearch = (): QuickActionsSnapPoint => {
  const scrollport = document.querySelector('[data-slot="campaign-content-scroll"]')
  const scrollTop = scrollport instanceof HTMLElement ? scrollport.scrollTop : 0
  return scrollTop > QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX
    ? QUICK_ACTIONS_SNAP_COLLAPSED
    : QUICK_ACTIONS_SNAP_DOCK
}

export const CampaignQuickActionsDrawer = ({
  actions,
}: {
  actions: readonly CampaignQuickAction[]
}) => {
  const pathname = usePathname()
  const { context } = useCampaignQuickActionContext()
  const excludeContext = resolveHomeSearchExcludeContext(pathname, context)
  const { snapPoint, setSnapPoint, isDock, isFull } = useCampaignQuickActionsSnap()
  const { uiFocused } = useHomeSearch()
  const showActions = actions.length > 0 && isDock && !isFull
  const showSearchResults = isDock || isFull

  const handleSnapPointChange = useCallback(
    (next: QuickActionsSnapPoint | string | number | null) => {
      if (
        next === QUICK_ACTIONS_SNAP_COLLAPSED ||
        next === QUICK_ACTIONS_SNAP_DOCK ||
        next === QUICK_ACTIONS_SNAP_FULL
      ) {
        setSnapPoint(next)
        return
      }
      setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
    },
    [setSnapPoint],
  )

  const toggleSnap = useCallback(() => {
    setSnapPoint((current) => {
      if (quickActionsSnapIsFull(current)) return restoreSnapAfterSearch()
      if (quickActionsSnapIsDock(current)) return QUICK_ACTIONS_SNAP_COLLAPSED
      return QUICK_ACTIONS_SNAP_DOCK
    })
  }, [setSnapPoint])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
      }
    },
    [setSnapPoint],
  )

  useEffect(() => {
    if (!uiFocused) return
    if (!quickActionsSnapIsFull(snapPoint)) {
      setSnapPoint(QUICK_ACTIONS_SNAP_FULL)
    }
  }, [snapPoint, setSnapPoint, uiFocused])

  useEffect(() => {
    if (uiFocused) return
    setSnapPoint(restoreSnapAfterSearch())
  }, [setSnapPoint, uiFocused])

  return (
    <Drawer
      open
      modal={false}
      swipeDirection="down"
      snapPoints={uiFocused ? [QUICK_ACTIONS_SNAP_FULL] : SNAP_POINTS}
      snapPoint={uiFocused ? QUICK_ACTIONS_SNAP_FULL : snapPoint}
      onSnapPointChange={handleSnapPointChange}
      onOpenChange={handleOpenChange}
      disablePointerDismissal
    >
      <DrawerContent
        id="CampaignQuickActionsDrawer"
        className={cn(
          'border-t border-border bg-background text-foreground shadow-[0_-4px_24px_-8px_rgb(0_0_0/0.12)] print:hidden',
          isFull && 'z-[60] h-dvh max-h-dvh [--drawer-height:100dvh]',
        )}
      >
        <DrawerTitle className="sr-only">Ações rápidas</DrawerTitle>
        <button
          type="button"
          onClick={toggleSnap}
          aria-expanded={isDock || isFull}
          aria-controls="quickActionContext"
          className="flex w-full shrink-0 cursor-grab flex-col items-center border-0 bg-transparent px-4 pt-2 pb-0.5 active:cursor-grabbing"
          aria-label={isDock || isFull ? 'Ocultar ações rápidas' : 'Mostrar ações rápidas'}
        >
          <span aria-hidden className="mb-1 block h-1 w-12 rounded-full bg-muted" />
        </button>
        <div
          id="quickActionContext"
          className={cn(
            'flex min-h-0 flex-col overflow-y-auto px-4',
            isFull
              ? 'flex-1 gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]'
              : cn(
                  'gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]',
                  isDock ? 'flex-1' : 'shrink-0',
                ),
          )}
          data-snap={isFull ? 'full' : isDock ? 'dock' : 'collapsed'}
        >
          {showActions ? (
            <div className="-mx-4 w-[calc(100%+2rem)]">
              <CampaignHomeActionStrip
                variant="strip"
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
          <HomeSearchExcludeProvider value={excludeContext}>
            <CampaignGlobalSearchBody
              placeholder={isDock || isFull ? undefined : ''}
              showResults={showSearchResults}
            />
          </HomeSearchExcludeProvider>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
