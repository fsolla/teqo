'use client'

import { ArrowLeft, X } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { useCampaignHomeSearchChrome } from '@/components/campaign/shell/CampaignHomeSearchChromeContext'
import {
  useCampaignHeaderActions,
  useCampaignPageChromeRole,
} from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageChromeDisplay } from '@/components/campaign/shell/CampaignPageChromeDisplay'
import { useCampaignWizardChrome } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { HOME_SEARCH_COLLAPSE_ARIA_LABEL } from '@/lib/campaignHomeSearchContract'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
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

const wizardTitleSkeletonClass = 'mx-auto motion-reduce:animate-none bg-primary-foreground/20'

/**
 * Shared look for icon controls registered into the app top bar's right
 * cluster (C94/C95 slot) — the same white-on-primary treatment the wizard
 * buttons and the notification bell use. Consumers compose `md:` overrides on
 * top (e.g. the bell switches to muted on desktop).
 */
export const campaignMobileHeaderIconClassName =
  'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'

export const CampaignMobileTopBar = ({ notificationBell }: { notificationBell?: ReactNode }) => {
  const chrome = useCampaignWizardChrome()
  const homeSearchChrome = useCampaignHomeSearchChrome()
  const headerActions = useCampaignHeaderActions()
  const role = useCampaignPageChromeRole()
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
              <CampaignWizardNavLink href={chrome.previousHref} replace>
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
          <Button
            variant="ghost"
            size="icon"
            className={wizardDismissButtonClass}
            asChild
            disabled={isPending}
          >
            <CampaignWizardNavLink href={chrome.dismissHref} aria-label={WIZARD_DISMISS_ARIA_LABEL}>
              <X className="size-5" aria-hidden />
            </CampaignWizardNavLink>
          </Button>
        </div>
      </header>
    )
  }

  return (
    <header
      data-slot="campaign-mobile-top-bar"
      data-mode="app"
      data-home-search-focused={homeSearchChrome?.focused || undefined}
      aria-label={WIZARD_APP_TOP_BAR_ARIA_LABEL}
      className={cn(
        'flex min-h-14 shrink-0 items-center gap-3 bg-primary px-4 text-primary-foreground md:hidden print:hidden',
        'pt-[max(0px,env(safe-area-inset-top))]',
      )}
    >
      {homeSearchChrome?.focused ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={wizardNavButtonClass}
          aria-label={HOME_SEARCH_COLLAPSE_ARIA_LABEL}
          onClick={homeSearchChrome.collapse}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          Voltar
        </Button>
      ) : isStaffCampaignRole(role) ? null : (
        // C102: staff navigates from the bottom bar + "Mais" — the hamburger is
        // only the leader's (lockdown, no bottom nav). The sheet itself is
        // unmounted for staff in CampaignSidebar.
        <SidebarTrigger className="text-primary-foreground" />
      )}
      <CampaignPageChromeDisplay layout="mobile" />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {Object.entries(headerActions).map(([id, node]) => (
          <Fragment key={id}>{node}</Fragment>
        ))}
        {notificationBell ?? null}
      </div>
    </header>
  )
}
