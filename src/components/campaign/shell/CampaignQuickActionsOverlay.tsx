'use client'

import { usePathname } from 'next/navigation'

import { CampaignGlobalSearchBody } from '@/components/campaign/dashboard/CampaignGlobalSearchMount'
import { CampaignHomeActionStrip } from '@/components/campaign/dashboard/CampaignHomeActionStrip'
import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { HomeSearchExcludeProvider } from '@/components/campaign/dashboard/HomeSearchExcludeContext'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/Drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { resolveHomeSearchExcludeContext } from '@/lib/homeSearchExcludeCurrentEntity'
import { cn } from '@/lib/utils'

const overlayRetractionClass = (retracted: boolean) =>
  cn(
    'grid min-h-0 transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none',
    retracted
      ? 'grid-rows-[0fr] opacity-0 pointer-events-none motion-reduce:opacity-0'
      : 'grid-rows-[1fr] opacity-100 motion-reduce:opacity-100',
  )

const OverlayActionsChrome = ({
  actions,
  retracted,
}: {
  actions: readonly CampaignQuickAction[]
  retracted: boolean
}) => {
  if (actions.length === 0) return null

  return (
    <div
      data-slot="quick-actions-chrome"
      data-retracted={retracted || undefined}
      className={overlayRetractionClass(retracted)}
      aria-hidden={retracted || undefined}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="-mx-4 w-[calc(100%+2rem)] md:mx-0 md:w-auto">
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
      </div>
    </div>
  )
}

const OverlaySearchChrome = ({ className }: { className?: string }) => (
  <div data-slot="quick-actions-search" className={cn('min-w-0', className)}>
    <CampaignGlobalSearchBody />
  </div>
)

const CampaignQuickActionsOverlayBody = ({
  actions,
}: {
  actions: readonly CampaignQuickAction[]
}) => {
  const { uiFocused: focused } = useHomeSearch()

  return (
    <div className="flex min-h-0 flex-col">
      <div className="order-1 md:order-2">
        <OverlayActionsChrome actions={actions} retracted={focused} />
      </div>
      <OverlaySearchChrome
        className={cn('order-2 min-w-0 md:order-1', focused ? 'mt-0' : 'mt-4 md:mt-0 md:mb-4')}
      />
    </div>
  )
}

const CampaignQuickActionsOverlayContent = ({
  actions,
}: {
  actions: readonly CampaignQuickAction[]
}) => {
  const pathname = usePathname()
  const { context } = useCampaignQuickActionContext()
  const excludeContext = resolveHomeSearchExcludeContext(pathname, context)

  return (
    <HomeSearchExcludeProvider value={excludeContext}>
      <CampaignQuickActionsOverlayBody actions={actions} />
    </HomeSearchExcludeProvider>
  )
}

export const CampaignQuickActionsOverlay = ({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: readonly CampaignQuickAction[]
}) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          id="CampaignQuickActionsOverlay"
          className="max-h-[85dvh] border-t border-border bg-background text-foreground"
        >
          <DrawerTitle className="sr-only">Ações rápidas</DrawerTitle>
          <DrawerDescription className="sr-only">
            Ações do contexto e busca na campanha
          </DrawerDescription>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <CampaignQuickActionsOverlayContent actions={actions} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="CampaignQuickActionsOverlay"
        className="flex max-h-[min(85dvh,40rem)] w-[calc(100vw-2rem)] max-w-lg flex-col gap-4 overflow-hidden p-4 sm:p-6"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Ações rápidas</DialogTitle>
          <DialogDescription>Ações do contexto e busca na campanha</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <CampaignQuickActionsOverlayContent actions={actions} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
