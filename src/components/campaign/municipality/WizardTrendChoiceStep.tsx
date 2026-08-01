'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'

import { WizardTrendSkipTrailing } from '@/components/campaign/municipality/WizardTrendSkipTrailing'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { Badge } from '@/components/ui/Badge'
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
import { wizardTrendHref } from '@/lib/campaignActionRoutes'
import { wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import {
  politicalTrendWizardMetaByStatus,
  type PoliticalTrendWizardMetaEntry,
} from '@/lib/politicalTrendWizardMeta'
import {
  resolveWizardTrendSkip,
  selectablePoliticalTrendStatuses,
  WIZARD_CURRENT_TREND_CHIP_LABEL,
} from '@/lib/politicalTrendWizardUi'
import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'
import { cn } from '@/lib/utils'
import { wizardChainEndHref } from '@/lib/wizardActionChain'
import { wizardStepPreviousHref } from '@/lib/wizardBack'
import {
  WIZARD_THUMB_TILE_GRID_CLASS,
  WIZARD_THUMB_TILE_ITEM_CLASS,
} from '@/lib/wizardThumbGrid'

type WizardTrendChoiceStepProps = {
  actionSlug: string
  municipalityName: string
  municipalitySlug: string
  currentStatus: PoliticalTrendStatusValue | null
  entryAction?: CampaignWizardActionId
  prefillExtraParams?: Record<string, string>
  returnPath?: string
}

const CurrentTrendCard = ({ entry }: { entry: PoliticalTrendWizardMetaEntry }) => {
  const Icon = entry.icon

  return (
    <div
      className={cn(
        'col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3',
        WIZARD_THUMB_TILE_ITEM_CLASS,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className={cn('size-5 shrink-0', entry.iconClassName)} aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{entry.label}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{entry.changeDescription}</p>
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0">
        {WIZARD_CURRENT_TREND_CHIP_LABEL}
      </Badge>
    </div>
  )
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
  const currentEntry = currentStatus ? politicalTrendWizardMetaByStatus[currentStatus] : null

  return (
    <>
      <CampaignWizardShell
        flowTitle={wizardFlowTitleForSlug(actionSlug)}
        isEntryStep={false}
        stepTitle={null}
        previousHref={wizardStepPreviousHref({
          step: 'trend-choice',
          actionSlug,
          returnPath,
        })}
        dismissHref={wizardChainEndHref(returnPath)}
        municipalityLabel={municipalityName}
        skip={skip}
        trailingAction={skip ? <WizardTrendSkipTrailing skip={skip} /> : undefined}
        contentAlign="end"
      >
        <ul className={WIZARD_THUMB_TILE_GRID_CLASS}>
          {currentEntry ? <CurrentTrendCard entry={currentEntry} /> : null}
          {options.map((status) => {
            const entry = politicalTrendWizardMetaByStatus[status]
            const Icon = entry.icon
            return (
              <li key={status} className={cn('relative', WIZARD_THUMB_TILE_ITEM_CLASS)}>
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
                    'flex aspect-square w-full flex-col justify-between rounded-lg border border-border bg-background p-3 pr-10 text-left text-foreground',
                    'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <Icon className={cn('size-5 shrink-0', entry.iconClassName)} aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{entry.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
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
