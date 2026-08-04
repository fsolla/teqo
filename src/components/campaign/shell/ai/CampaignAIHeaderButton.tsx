'use client'

import { Bot } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'

export const CampaignAIHeaderButton = ({ className }: { className?: string }) => {
  const ctx = useAISidebar()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-11 hidden shrink-0 md:inline-flex', className)}
      aria-label="Sollinha — Assistente virtual"
      title="Sollinha — Assistente virtual"
      onClick={() => ctx?.toggle()}
    >
      <Bot className="size-5" />
    </Button>
  )
}
