'use client'

import { Bot, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer'

import { CampaignAIChat } from '@/components/campaign/shell/ai/CampaignAIChat'
import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'

export const CampaignAIDrawer = () => {
  const ctx = useAISidebar()

  if (!ctx) return null

  const { open, setOpen } = ctx

  return (
    <Drawer open={open} onOpenChange={(next) => setOpen(next)} showSwipeHandle>
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
              onClick={() => setOpen(false)}
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
