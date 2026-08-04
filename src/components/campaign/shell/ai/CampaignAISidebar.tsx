'use client'

import { Bot, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer'
import { useIsMobile } from '@/hooks/use-mobile'

import { CampaignAIChat } from '@/components/campaign/shell/ai/CampaignAIChat'
import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'

export const CampaignAISidebar = () => {
  const ctx = useAISidebar()
  const isMobile = useIsMobile()

  if (!ctx) return null

  const { open, setOpen, setOpenMobile } = ctx

  // Mobile: full-screen Drawer (Panel is hidden on mobile via className)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => setOpenMobile(next)} showSwipeHandle>
        <DrawerContent
          id="CampaignAISidebar"
          className="h-[90dvh] border-t border-border bg-background text-foreground"
        >
          <DrawerTitle className="sr-only">Sollinha — Assistente virtual</DrawerTitle>
          <div className="grid h-full grid-rows-[auto_1fr]">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="size-4" />
                Sollinha
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpenMobile(false)}
                aria-label="Fechar"
              >
                <X className="size-4" />
              </Button>
            </div>
            <CampaignAIChat />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: rendered inside a react-resizable-panels Panel — sizing is handled by the panel
  return (
    <div className="grid h-full grid-rows-[auto_1fr] border-l border-border bg-background">
      <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4" />
          Sollinha
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </div>
      <CampaignAIChat />
    </div>
  )
}
