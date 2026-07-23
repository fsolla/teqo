import type { ReactNode } from 'react'

import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/utils'

export type CampaignMetric = {
  label: string
  value: string
  detail?: ReactNode
  emphasize?: boolean
  progress?: number
  valueAriaLabel?: string
}

export const CampaignMetricStrip = ({
  metrics,
  className,
}: {
  metrics: CampaignMetric[]
  className?: string
}) => (
  <dl
    className={cn(
      'grid grid-cols-1 gap-0 divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0',
      className,
    )}
  >
    {metrics.map((metric) => (
      <div
        key={metric.label}
        className={cn(
          'flex min-w-0 flex-col gap-1 px-4 py-2',
          metric.emphasize ? 'bg-muted/40' : undefined,
        )}
      >
        <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
        <dd
          className={cn(
            'tabular-nums tracking-tight',
            metric.emphasize
              ? 'text-2xl font-semibold text-foreground'
              : 'text-lg font-medium text-foreground',
          )}
          aria-label={metric.valueAriaLabel}
        >
          {metric.value}
        </dd>
        {metric.detail ? (
          typeof metric.detail === 'string' ? (
            <p className="text-xs text-muted-foreground tabular-nums">{metric.detail}</p>
          ) : (
            <div className="min-w-0">{metric.detail}</div>
          )
        ) : null}
        {metric.progress !== undefined ? (
          <Progress
            value={metric.progress}
            className="mt-1"
            aria-label={`${metric.label}: ${metric.progress}%`}
          />
        ) : null}
      </div>
    ))}
  </dl>
)
