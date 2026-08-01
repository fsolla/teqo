'use client'

import { InfoIcon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { WizardLeadershipForm } from '@/components/campaign/leadership/WizardLeadershipForm'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import {
  WIZARD_LEADERSHIP_ADD_TILE_LABEL,
  WIZARD_LEADERSHIP_CONTINUE_LABEL,
  WIZARD_LEADERSHIP_EMPTY_GRID,
  WIZARD_LEADERSHIP_EMPTY_NOTES,
  WIZARD_LEADERSHIP_FORM_CREATE_TITLE,
  WIZARD_LEADERSHIP_FORM_EDIT_TITLE,
  WIZARD_LEADERSHIP_GRID_TITLE,
  WIZARD_LEADERSHIP_SAVED_TOAST,
  wizardFlowTitleForSlug,
} from '@/lib/campaignWizardCopy'
import { truncateNameAtWordBoundary } from '@/lib/leadershipNameTruncate'
import { cn } from '@/lib/utils'
import {
  resolveWizardChainEntry,
  wizardChainContinueHref,
  wizardChainEndHref,
} from '@/lib/wizardActionChain'
import { WIZARD_LEADERSHIP_FORM_LAYER, wizardStepPreviousHref } from '@/lib/wizardBack'
import {
  resolveWizardLeadershipSkip,
  type WizardLeadershipTileViewModel,
} from '@/lib/wizardLeadershipContract'

type WizardLeadershipStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  entryAction?: CampaignWizardActionId
  initialTiles: WizardLeadershipTileViewModel[]
  initialLeadershipId?: number
  returnPath?: string
}

type WizardLeadershipMode =
  | { kind: 'grid' }
  | { kind: 'form'; leadership: WizardLeadershipTileViewModel | null }

const notesLabel = (notes: string | null): string =>
  notes?.trim() ? notes.trim() : WIZARD_LEADERSHIP_EMPTY_NOTES

const secondaryContact = (tile: WizardLeadershipTileViewModel): string | null =>
  tile.phone?.trim() || tile.email?.trim() || null

export const WizardLeadershipStep = ({
  actionSlug,
  municipalityId,
  municipalityName,
  municipalitySlug,
  entryAction,
  initialTiles,
  initialLeadershipId,
  returnPath,
}: WizardLeadershipStepProps) => {
  const router = useRouter()
  const [isContinuing, startContinueTransition] = useTransition()
  const initialMode = useMemo((): WizardLeadershipMode => {
    if (initialLeadershipId === undefined) {
      return { kind: 'grid' }
    }
    const leadership = initialTiles.find((tile) => tile.id === initialLeadershipId)
    return leadership ? { kind: 'form', leadership } : { kind: 'grid' }
  }, [initialLeadershipId, initialTiles])
  const [mode, setMode] = useState<WizardLeadershipMode>(initialMode)
  const [dirty, setDirty] = useState(false)
  const [infoTile, setInfoTile] = useState<WizardLeadershipTileViewModel | null>(null)

  const skipConfig = resolveWizardLeadershipSkip(entryAction, municipalitySlug, returnPath)
  const chainContinueHref = wizardChainContinueHref(
    resolveWizardChainEntry(entryAction, 'update-leadership'),
    'update-leadership',
    municipalitySlug,
    returnPath,
  )

  const stepTitle =
    mode.kind === 'grid'
      ? WIZARD_LEADERSHIP_GRID_TITLE
      : mode.leadership
        ? WIZARD_LEADERSHIP_FORM_EDIT_TITLE
        : WIZARD_LEADERSHIP_FORM_CREATE_TITLE

  const trailingAction = skipConfig ? (
    <Button variant="ghost" size="sm" className="min-h-11 px-2 text-sm" asChild>
      <CampaignWizardNavLink href={skipConfig.href}>{skipConfig.label}</CampaignWizardNavLink>
    </Button>
  ) : undefined

  const handleSaved = useCallback(() => {
    recordLastActedMunicipality(municipalitySlug)
    setDirty(true)
    setMode({ kind: 'grid' })
    router.refresh()
    toast.success(WIZARD_LEADERSHIP_SAVED_TOAST)
  }, [municipalitySlug, router])

  const handlePopFormLayer = useCallback(() => {
    setMode({ kind: 'grid' })
  }, [])

  const handleContinue = () => {
    startContinueTransition(() => {
      router.replace(chainContinueHref)
    })
  }

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      stepTitle={stepTitle}
      isEntryStep={false}
      previousHref={wizardStepPreviousHref({
        step: 'leadership-grid',
        actionSlug,
        returnPath,
      })}
      dismissHref={wizardChainEndHref(returnPath)}
      municipalityLabel={municipalityName}
      skip={skipConfig}
      trailingAction={trailingAction}
      contentFocus={mode.kind === 'form' ? 'none' : 'title'}
      clientLayer={mode.kind === 'form' ? WIZARD_LEADERSHIP_FORM_LAYER : undefined}
      onPopClientLayer={handlePopFormLayer}
    >
      {mode.kind === 'form' ? (
        <WizardLeadershipForm
          municipalityId={municipalityId}
          municipalitySlug={municipalitySlug}
          leadership={mode.leadership}
          onSaved={handleSaved}
          onCancel={handlePopFormLayer}
        />
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-4">
            {initialTiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{WIZARD_LEADERSHIP_EMPTY_GRID}</p>
            ) : null}
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {initialTiles.map((tile) => (
                <li key={tile.id}>
                  <LeadershipTileButton
                    tile={tile}
                    onOpen={() => setMode({ kind: 'form', leadership: tile })}
                    onInfo={() => setInfoTile(tile)}
                  />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent p-3 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setMode({ kind: 'form', leadership: null })}
                >
                  <PlusIcon className="size-6" aria-hidden />
                  {WIZARD_LEADERSHIP_ADD_TILE_LABEL}
                </button>
              </li>
            </ul>
          </div>
        </TooltipProvider>
      )}

      {dirty && mode.kind === 'grid' ? (
        <div className="fixed bottom-4 right-4 z-20 pb-[max(0px,env(safe-area-inset-bottom))]">
          <Button className="min-h-11 shadow-md" onClick={handleContinue} disabled={isContinuing}>
            {WIZARD_LEADERSHIP_CONTINUE_LABEL}
          </Button>
        </div>
      ) : null}

      <Drawer open={infoTile !== null} onOpenChange={(open) => !open && setInfoTile(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{infoTile?.name ?? 'Observação'}</DrawerTitle>
            <DrawerDescription className="sr-only">
              Observação interna da liderança
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[50vh] overflow-y-auto px-4 pb-6 text-sm whitespace-pre-wrap">
            {notesLabel(infoTile?.notes ?? null)}
          </div>
        </DrawerContent>
      </Drawer>
    </CampaignWizardShell>
  )
}

type LeadershipTileButtonProps = {
  tile: WizardLeadershipTileViewModel
  onOpen: () => void
  onInfo: () => void
}

const LeadershipTileButton = ({ tile, onOpen, onInfo }: LeadershipTileButtonProps) => {
  const secondary = secondaryContact(tile)
  const noteText = notesLabel(tile.notes)

  return (
    <div className="relative aspect-square w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-full w-full flex-col rounded-xl border border-border bg-transparent p-3 pr-11 text-left transition-colors',
              'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'pointer-coarse:hover:bg-transparent',
            )}
            onClick={onOpen}
          >
            <div className="max-w-full">
              {tile.supportStatus ? <SupportStatusBadge status={tile.supportStatus} /> : null}
            </div>
            <div className="mt-auto flex flex-col gap-1">
              <p className="text-sm font-medium leading-snug text-foreground">
                {truncateNameAtWordBoundary(tile.name, 28)}
              </p>
              {secondary ? (
                <p className="truncate text-xs text-muted-foreground">{secondary}</p>
              ) : null}
              {!tile.exclusive ? (
                <Badge variant="outline" className="mt-1 w-fit text-xs">
                  Não exclusivo
                </Badge>
              ) : null}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent className="pointer-coarse:hidden max-w-xs whitespace-pre-wrap">
          {noteText}
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onInfo}
        aria-label={`Ver observação de ${tile.name}`}
      >
        <InfoIcon className="size-4" aria-hidden />
      </button>
    </div>
  )
}
