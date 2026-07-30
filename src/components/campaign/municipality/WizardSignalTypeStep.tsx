'use client'

import { Info } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { wizardActionHref, wizardSignalHref } from '@/lib/campaignActionRoutes'
import { municipalitySignalTypeMeta } from '@/lib/municipalitySignalTypeMeta'
import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import { cn } from '@/lib/utils'
import {
  shouldShowWizardSignalSkip,
  WIZARD_SIGNAL_SKIP_LABEL,
  WIZARD_SIGNAL_TYPE_STEP_TITLE,
  wizardSignalSkipHref,
} from '@/lib/wizardSignalUi'

type WizardSignalTypeStepProps = {
  actionSlug: string
  municipalityName: string
  municipalitySlug: string
  entryAction?: CampaignWizardActionId
}

export const WizardSignalTypeStep = ({
  actionSlug,
  municipalityName,
  municipalitySlug,
  entryAction,
}: WizardSignalTypeStepProps) => {
  const router = useRouter()
  const [infoType, setInfoType] = useState<MunicipalitySignalType | null>(null)
  const infoEntry = infoType
    ? municipalitySignalTypeMeta.find((entry) => entry.type === infoType)
    : null
  const showSkip = shouldShowWizardSignalSkip(entryAction)

  return (
    <>
      <CampaignWizardShell
        stepTitle={WIZARD_SIGNAL_TYPE_STEP_TITLE}
        previousHref={wizardActionHref(actionSlug)}
        municipalityLabel={municipalityName}
        contentAlign="end"
        trailingAction={
          showSkip ? (
            <Button variant="link" size="sm" className="h-auto px-2 py-1 text-xs" asChild>
              <Link href={wizardSignalSkipHref()}>{WIZARD_SIGNAL_SKIP_LABEL}</Link>
            </Button>
          ) : undefined
        }
      >
        <ul className="grid list-none grid-cols-2 gap-3 md:grid-cols-3">
          {municipalitySignalTypeMeta.map((entry) => {
            const Icon = entry.icon
            return (
              <li key={entry.type} className="relative">
                <button
                  type="button"
                  className={cn(
                    'flex aspect-square w-full flex-col justify-between rounded-lg border border-border bg-transparent p-3 pr-10 text-left',
                    'transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  onClick={() =>
                    router.push(
                      wizardSignalHref(actionSlug, municipalitySlug, entry.type, entryAction),
                    )
                  }
                >
                  <Icon className="size-5 shrink-0 text-foreground" aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{entry.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {entry.shortDescription}
                    </span>
                  </div>
                </button>
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
                <DrawerClose render={<Button variant="outline" className="min-h-11 w-full" />}>
                  Fechar
                </DrawerClose>
              </DrawerFooter>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </>
  )
}
