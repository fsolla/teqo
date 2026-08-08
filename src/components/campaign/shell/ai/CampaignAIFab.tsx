'use client'

import { Bot } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'

export const CampaignAIFab = ({ className }: { className?: string }) => {
  const ctx = useAISidebar()

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-20 right-4 z-40 md:hidden print:hidden',
        'pb-[max(0px,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <Button
        type="button"
        size="icon"
        className="pointer-events-auto size-8 rounded-full shadow-lg"
        aria-label="Sollinha — Assistente virtual"
        onClick={() => ctx?.setOpen(true)}
      >
        <Bot className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
