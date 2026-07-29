import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'
import { cn } from '@/lib/utils'

/** Request-time aggregate stamp — absolute Bahia time on hover. */
export const CampaignDataFreshness = ({ asOf, className }: { asOf: Date; className?: string }) => {
  const iso = asOf.toISOString()

  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      <time dateTime={iso} title={formatBahiaDateTimeLabel(iso)}>
        Atualizado agora
      </time>
    </p>
  )
}
