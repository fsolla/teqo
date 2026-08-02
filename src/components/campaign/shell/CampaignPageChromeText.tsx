import type { CampaignPageChrome } from '@/lib/campaignPageChrome'
import { cn } from '@/lib/utils'

export const CampaignPageChromeText = ({
  chrome,
  layout,
  className,
}: {
  chrome: CampaignPageChrome
  layout: 'mobile' | 'desktop'
  className?: string
}) => {
  if (layout === 'desktop') {
    return (
      <p
        data-slot="campaign-page-chrome"
        className={cn('min-w-0 truncate text-sm font-medium text-foreground', className)}
      >
        <span data-slot="campaign-page-chrome-title">{chrome.title}</span>
        {chrome.subtitle ? (
          <span className="font-normal text-muted-foreground"> {chrome.subtitle}</span>
        ) : null}
      </p>
    )
  }

  return (
    <div data-slot="campaign-page-chrome" className={cn('min-w-0 flex-1 leading-tight', className)}>
      <span data-slot="campaign-page-chrome-title" className="block truncate text-sm font-semibold">
        {chrome.title}
      </span>
      {chrome.subtitle ? (
        <span className="block truncate text-xs text-primary-foreground/80">{chrome.subtitle}</span>
      ) : null}
    </div>
  )
}
