'use client'

import { Bot, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { CampaignAIChat } from '@/components/campaign/shell/ai/CampaignAIChat'
import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'

export const CampaignAISidebar = () => {
  const ctx = useAISidebar()

  if (!ctx) return null

  const { setOpen } = ctx

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
