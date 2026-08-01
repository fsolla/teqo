'use client'

import { useOpsSyncState } from '@/components/campaign/opsSync/CampaignOpsSyncProvider'
import { resolveOpsSyncChromeLabel } from '@/components/campaign/opsSync/opsSyncChromeCopy'
import { cn } from '@/lib/utils'

export const OpsSyncStatusChrome = ({ className }: { className?: string }) => {
  const { status, lastSyncedAt } = useOpsSyncState()
  const label = resolveOpsSyncChromeLabel({ status, lastSyncedAt })

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'truncate text-xs text-muted-foreground tabular-nums',
        status === 'error' && 'text-destructive',
        className,
      )}
    >
      {label}
    </p>
  )
}
