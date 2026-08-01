'use client'

import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'

import { CampaignListResults } from '@/components/campaign/shared/CampaignListPending'
import {
  toCampaignWizardChromeState,
  useSetCampaignWizardChrome,
  type CampaignWizardChromeSkip,
} from '@/components/campaign/shell/CampaignWizardChromeContext'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import { WIZARD_STEP_PENDING_MESSAGE, wizardFlowChromeAriaLabel } from '@/lib/campaignWizardCopy'
import { cn } from '@/lib/utils'

export type CampaignWizardShellProps = {
  flowTitle: string
  stepTitle?: string | null
  isEntryStep: boolean
  previousHref: string
  dismissHref?: string
  municipalityLabel?: string
  skip?: CampaignWizardChromeSkip
  trailingAction?: ReactNode
  contentAlign?: 'start' | 'end'
  /** When `'none'`, the shell does not move focus to the step title — use on form steps that autofocus an input. */
  contentFocus?: 'title' | 'none'
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
  contentFocus = 'title',
  children,
}: CampaignWizardShellProps) => {
  const hasStepTitle = stepTitle != null && stepTitle !== ''
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
    if (!hasStepTitle || contentFocus === 'none') return
    titleRef.current?.focus()
  }, [contentFocus, hasStepTitle, stepTitle])

  return (
    <div className="flex min-h-full w-full flex-col">
      {trailingAction ? <div className="hidden justify-end md:flex">{trailingAction}</div> : null}

      <main
        aria-labelledby={hasStepTitle ? titleId : undefined}
        aria-label={hasStepTitle ? undefined : wizardFlowChromeAriaLabel(flowTitle)}
        className={cn(
          'flex flex-1 flex-col pb-6 md:justify-start md:py-6',
          hasStepTitle ? 'pt-3' : 'pt-2',
          contentAlign === 'end' ? 'justify-end md:justify-start' : 'justify-start',
        )}
      >
        <CampaignListResults
          pendingMessage={WIZARD_STEP_PENDING_MESSAGE}
          className={cn(
            'flex flex-1 flex-col',
            hasStepTitle ? 'gap-6' : 'gap-0',
            contentAlign === 'end' ? 'justify-end md:justify-start' : 'justify-start',
          )}
        >
          {municipalityLabel ? (
            <p className="hidden max-w-prose truncate text-sm text-muted-foreground md:block">
              {municipalityLabel}
            </p>
          ) : null}
          {hasStepTitle ? (
            <h1
              ref={titleRef}
              id={titleId}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight outline-none md:text-2xl"
            >
              {stepTitle}
            </h1>
          ) : null}
          {children}
        </CampaignListResults>
      </main>
    </div>
  )
}
