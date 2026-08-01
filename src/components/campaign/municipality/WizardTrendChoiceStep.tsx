'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'

import { WizardTrendSkipTrailing } from '@/components/campaign/municipality/WizardTrendSkipTrailing'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { wizardActionHref, wizardTrendHref } from '@/lib/campaignActionRoutes'
import { wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import {
  politicalTrendWizardMetaByStatus,
  type PoliticalTrendWizardMetaEntry,
} from '@/lib/politicalTrendWizardMeta'
import {
  resolveWizardTrendSkip,
  selectablePoliticalTrendStatuses,
  wizardTrendChoiceStepTitle,
} from '@/lib/politicalTrendWizardUi'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import { cn } from '@/lib/utils'
import { wizardChainEndHref } from '@/lib/wizardActionChain'

type WizardTrendChoiceStepProps = {
  actionSlug: string
  municipalityName: string
  municipalitySlug: string
  currentStatus: PoliticalTrendStatusValue | null
  entryAction?: CampaignWizardActionId
  prefillExtraParams?: Record<string, string>
  returnPath?: string
}

export const WizardTrendChoiceStep = ({
  actionSlug,
  municipalityName,
  municipalitySlug,
  currentStatus,
  entryAction,
  prefillExtraParams,
  returnPath,
}: WizardTrendChoiceStepProps) => {
  const [infoEntry, setInfoEntry] = useState<PoliticalTrendWizardMetaEntry | null>(null)
  const skip = resolveWizardTrendSkip(entryAction, municipalitySlug, returnPath)
  const options = selectablePoliticalTrendStatuses(currentStatus)

  return (
    <>
      <CampaignWizardShell
        flowTitle={wizardFlowTitleForSlug(actionSlug)}
        isEntryStep={false}
        stepTitle={wizardTrendChoiceStepTitle(currentStatus)}
        previousHref={wizardActionHref(actionSlug, municipalitySlug, { entryAction, returnPath })}
        dismissHref={wizardChainEndHref(returnPath)}
        municipalityLabel={municipalityName}
        skip={skip}
        trailingAction={skip ? <WizardTrendSkipTrailing skip={skip} /> : undefined}
      >
        <ul className="grid list-none grid-cols-2 gap-3 md:grid-cols-3">
          {options.map((status) => {
            const entry = politicalTrendWizardMetaByStatus[status]
            const Icon = entry.icon
            return (
              <li key={status} className="relative">
                <CampaignWizardNavLink
                  href={wizardTrendHref(
                    actionSlug,
                    municipalitySlug,
                    status,
                    entryAction,
                    prefillExtraParams,
                    returnPath,
                  )}
                  className={cn(
                    'flex aspect-square w-full flex-col justify-between rounded-lg border bg-background p-3 pr-10 text-left',
                    entry.tileClassName,
                    'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{entry.label}</span>
                    <span className="line-clamp-2 text-xs opacity-80">
                      {entry.changeDescription}
                    </span>
                  </div>
                </CampaignWizardNavLink>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 size-8"
                  aria-label={`Informações sobre ${entry.label}`}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setInfoEntry(entry)
                  }}
                >
                  <Info className="size-4" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      </CampaignWizardShell>

      <Drawer open={infoEntry != null} onOpenChange={(open) => !open && setInfoEntry(null)}>
        <DrawerContent>
          {infoEntry ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{infoEntry.label}</DrawerTitle>
                <DrawerDescription>{infoEntry.changeDescription}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-2">
                <p className="text-sm text-muted-foreground">{infoEntry.infoContent}</p>
              </div>
              <DrawerFooter>
                <DrawerCloseButton>Fechar</DrawerCloseButton>
              </DrawerFooter>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </>
  )
}
