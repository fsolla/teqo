'use client'

import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'

import { CampaignListResults } from '@/components/campaign/shared/CampaignListPending'
import {
  toCampaignWizardChromeState,
  useSetCampaignWizardChrome,
  type CampaignWizardChromeSkip,
} from '@/components/campaign/shell/CampaignWizardChromeContext'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import { WIZARD_STEP_PENDING_MESSAGE } from '@/lib/campaignWizardCopy'
import { cn } from '@/lib/utils'

export type CampaignWizardShellProps = {
  flowTitle: string
  stepTitle: string
  isEntryStep: boolean
  previousHref: string
  dismissHref?: string
  municipalityLabel?: string
  skip?: CampaignWizardChromeSkip
  trailingAction?: ReactNode
  contentAlign?: 'start' | 'end'
  children: ReactNode
}

export const CampaignWizardShell = ({
  flowTitle,
  stepTitle,
  isEntryStep,
  previousHref,
  dismissHref = CAMPAIGN_HOME,
  municipalityLabel,
  skip,
  trailingAction,
  contentAlign = 'start',
  children,
}: CampaignWizardShellProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  const chrome = useMemo(
    () =>
      toCampaignWizardChromeState({
        flowTitle,
        isEntryStep,
        previousHref,
        dismissHref,
        municipalityLabel,
        skip,
      }),
    [dismissHref, flowTitle, isEntryStep, municipalityLabel, previousHref, skip],
  )

  useSetCampaignWizardChrome(chrome)

  useEffect(() => {
    titleRef.current?.focus()
  }, [stepTitle])

  return (
    <div className="flex min-h-full w-full flex-col">
      {trailingAction ? <div className="hidden justify-end md:flex">{trailingAction}</div> : null}

      <main
        aria-labelledby={titleId}
        className={cn(
          'flex flex-1 flex-col py-6 md:justify-start',
          contentAlign === 'end' ? 'justify-end md:justify-start' : 'justify-start',
        )}
      >
        <CampaignListResults
          pendingMessage={WIZARD_STEP_PENDING_MESSAGE}
          className={cn(
            'flex flex-1 flex-col gap-6',
            contentAlign === 'end' ? 'justify-end md:justify-start' : 'justify-start',
          )}
        >
          {municipalityLabel ? (
            <p className="hidden max-w-prose truncate text-sm text-muted-foreground md:block">
              {municipalityLabel}
            </p>
          ) : null}
          <h1
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none md:text-2xl"
          >
            {stepTitle}
          </h1>
          {children}
        </CampaignListResults>
      </main>
    </div>
  )
}
