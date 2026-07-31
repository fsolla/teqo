'use client'

import { ArrowLeft, X } from 'lucide-react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { useCampaignWizardChrome } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  WIZARD_APP_TOP_BAR_ARIA_LABEL,
  WIZARD_DISMISS_ARIA_LABEL,
  wizardFlowChromeAriaLabel,
  wizardMunicipalityChromeAriaLabel,
} from '@/lib/campaignWizardCopy'
import { cn } from '@/lib/utils'

const wizardNavButtonClass =
  'min-h-11 shrink-0 gap-1 px-2 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'

const wizardDismissButtonClass =
  'size-11 shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'

const wizardSkipButtonClass =
  'min-h-11 max-w-[9rem] px-2 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'

const wizardTitleSkeletonClass = 'mx-auto motion-reduce:animate-none bg-primary-foreground/20'

export const CampaignMobileTopBar = () => {
  const chrome = useCampaignWizardChrome()
  const { isPending } = useCampaignListTransition()

  if (chrome) {
    return (
      <header
        data-slot="campaign-mobile-top-bar"
        data-mode="wizard"
        aria-label={wizardFlowChromeAriaLabel(chrome.flowTitle)}
        className={cn(
          'flex min-h-14 shrink-0 items-center gap-2 bg-primary px-2 text-primary-foreground md:hidden print:hidden',
          'pt-[max(0px,env(safe-area-inset-top))]',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center">
          {chrome.stepKind === 'continue' && chrome.previousHref ? (
            <Button
              variant="ghost"
              size="sm"
              className={wizardNavButtonClass}
              asChild
              disabled={isPending}
            >
              <CampaignWizardNavLink href={chrome.previousHref}>
                <ArrowLeft className="size-4 shrink-0" aria-hidden />
                Voltar
              </CampaignWizardNavLink>
            </Button>
          ) : (
            <div className="size-11 shrink-0" aria-hidden />
          )}

          <div className="min-w-0 flex-1 px-1 text-center leading-tight">
            {isPending ? (
              <>
                <Skeleton className={cn(wizardTitleSkeletonClass, 'h-4 w-32 max-w-full')} />
                {chrome.municipalityLabel ? (
                  <Skeleton className={cn(wizardTitleSkeletonClass, 'mt-1 h-3 w-24 max-w-full')} />
                ) : null}
              </>
            ) : (
              <>
                <span className="block truncate text-sm font-semibold">{chrome.flowTitle}</span>
                {chrome.municipalityLabel ? (
                  <span
                    className="block truncate text-xs text-primary-foreground/80"
                    aria-label={wizardMunicipalityChromeAriaLabel(chrome.municipalityLabel)}
                  >
                    {chrome.municipalityLabel}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {chrome.skip ? (
            <Button
              variant="ghost"
              size="sm"
              className={wizardSkipButtonClass}
              asChild
              disabled={isPending}
            >
              <CampaignWizardNavLink href={chrome.skip.href} title={chrome.skip.label}>
                {chrome.skip.label}
              </CampaignWizardNavLink>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={wizardDismissButtonClass}
              asChild
              disabled={isPending}
            >
              <CampaignWizardNavLink
                href={chrome.dismissHref}
                aria-label={WIZARD_DISMISS_ARIA_LABEL}
              >
                <X className="size-5" aria-hidden />
              </CampaignWizardNavLink>
            </Button>
          )}
        </div>
      </header>
    )
  }

  return (
    <header
      data-slot="campaign-mobile-top-bar"
      data-mode="app"
      aria-label={WIZARD_APP_TOP_BAR_ARIA_LABEL}
      className={cn(
        'flex min-h-14 shrink-0 items-center gap-3 bg-primary px-4 text-primary-foreground md:hidden print:hidden',
        'pt-[max(0px,env(safe-area-inset-top))]',
      )}
    >
      <SidebarTrigger className="text-primary-foreground" />
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold">Jorge Solla</span>
        <span className="block truncate text-xs text-primary-foreground/80">Campanha · Bahia</span>
      </div>
    </header>
  )
}
