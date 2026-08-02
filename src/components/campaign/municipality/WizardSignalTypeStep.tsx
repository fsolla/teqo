'use client'

import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'

import { WizardSignalSkipTrailing } from '@/components/campaign/municipality/WizardSignalSkipTrailing'
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
import { wizardSignalHref } from '@/lib/campaignActionRoutes'
import { wizardFlowTitleForSlug } from '@/lib/campaignWizardCopy'
import {
  municipalitySignalTypeMetaByType,
  type MunicipalitySignalTypeMetaEntry,
} from '@/lib/municipalitySignalTypeMeta'
import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import { cn } from '@/lib/utils'
import { wizardChainEndHref } from '@/lib/wizardActionChain'
import { wizardStepPreviousHref } from '@/lib/wizardBack'
import { resolveWizardSignalSkip } from '@/lib/wizardSignalUi'
import {
  WIZARD_THUMB_TILE_GRID_CLASS,
  WIZARD_THUMB_TILE_ITEM_CLASS,
  wizardSignalTypesThumbOrder,
} from '@/lib/wizardThumbGrid'

type WizardSignalTypeStepProps = {
  actionSlug: string
  municipalityName: string
  municipalitySlug: string
  entryAction?: CampaignWizardActionId
  returnPath?: string
}

export const WizardSignalTypeStep = ({
  actionSlug,
  municipalityName,
  municipalitySlug,
  entryAction,
  returnPath,
}: WizardSignalTypeStepProps) => {
  const [infoType, setInfoType] = useState<MunicipalitySignalType | null>(null)
  const infoEntry = infoType ? municipalitySignalTypeMetaByType[infoType] : null
  const skip = resolveWizardSignalSkip(entryAction, municipalitySlug, returnPath)

  const thumbOrderedEntries = useMemo(
    () =>
      wizardSignalTypesThumbOrder.map(
        (type) => municipalitySignalTypeMetaByType[type],
      ) satisfies MunicipalitySignalTypeMetaEntry[],
    [],
  )

  return (
    <>
      <CampaignWizardShell
        flowTitle={wizardFlowTitleForSlug(actionSlug)}
        isEntryStep={false}
        stepTitle={null}
        previousHref={wizardStepPreviousHref({
          step: 'signal-type',
          actionSlug,
          returnPath,
        })}
        dismissHref={wizardChainEndHref(returnPath)}
        municipalityLabel={municipalityName}
        contentAlign="end"
        skip={skip}
        trailingAction={skip ? <WizardSignalSkipTrailing skip={skip} /> : undefined}
      >
        <ul className={WIZARD_THUMB_TILE_GRID_CLASS}>
          {thumbOrderedEntries.map((entry) => {
            const Icon = entry.icon
            return (
              <li key={entry.type} className={cn('relative', WIZARD_THUMB_TILE_ITEM_CLASS)}>
                <CampaignWizardNavLink
                  href={wizardSignalHref(
                    actionSlug,
                    municipalitySlug,
                    entry.type,
                    entryAction,
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
                      {entry.shortDescription}
                    </span>
                  </div>
                </CampaignWizardNavLink>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 size-8"
                  aria-label={`Informações sobre ${entry.label}`}
                  onClick={() => setInfoType(entry.type)}
                >
                  <Info className="size-4" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      </CampaignWizardShell>

      <Drawer open={infoEntry != null} onOpenChange={(open) => !open && setInfoType(null)}>
        <DrawerContent>
          {infoEntry ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{infoEntry.label}</DrawerTitle>
                <DrawerDescription>{infoEntry.shortDescription}</DrawerDescription>
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
