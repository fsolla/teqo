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
      {chrome.onTitleClick ? (
        <button
          type="button"
          data-slot="campaign-page-chrome-title"
          title={chrome.onTitleClick.hint}
          onClick={chrome.onTitleClick.action}
          className="flex min-w-0 max-w-full items-center gap-1.5 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block min-w-0 truncate">{chrome.title}</span>
          {chrome.onTitleClick.icon ? (
            <chrome.onTitleClick.icon
              className="size-3.5 shrink-0 text-current"
              aria-hidden="true"
            />
          ) : null}
        </button>
      ) : (
        <span
          data-slot="campaign-page-chrome-title"
          className="block truncate text-sm font-semibold"
        >
          {chrome.title}
        </span>
      )}
      {chrome.subtitle ? (
        <span className="block truncate text-xs text-primary-foreground/80">{chrome.subtitle}</span>
      ) : null}
    </div>
  )
}
