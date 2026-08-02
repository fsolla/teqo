'use client'

import { Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const CampaignQuickActionsFab = ({
  open,
  onOpenChange,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
}) => {
  if (open) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 right-4 z-40 print:hidden',
        'pb-[max(0px,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <Button
        type="button"
        size="icon"
        className="pointer-events-auto size-12 rounded-full shadow-lg"
        aria-label="Ações rápidas"
        onClick={() => onOpenChange(true)}
      >
        <Zap className="size-5" aria-hidden />
      </Button>
    </div>
  )
}
