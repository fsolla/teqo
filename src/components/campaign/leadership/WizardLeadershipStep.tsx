'use client'

import { InfoIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { WizardLeadershipForm } from '@/components/campaign/leadership/WizardLeadershipForm'
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
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  WIZARD_LEADERSHIP_ADD_TILE_LABEL,
  WIZARD_LEADERSHIP_CONTINUE_LABEL,
  WIZARD_LEADERSHIP_EMPTY_GRID,
  WIZARD_LEADERSHIP_EMPTY_NOTES,
  WIZARD_LEADERSHIP_FORM_CREATE_TITLE,
  WIZARD_LEADERSHIP_FORM_EDIT_TITLE,
  WIZARD_LEADERSHIP_GRID_TITLE,
  WIZARD_LEADERSHIP_SAVED_TOAST,
  WIZARD_LEADERSHIP_SKIP_LABEL,
  wizardFlowTitleForSlug,
} from '@/lib/campaignWizardCopy'
import { truncateNameAtWordBoundary } from '@/lib/leadershipNameTruncate'
import { cn } from '@/lib/utils'
import {
  showLeadershipWizardSkip,
  type WizardLeadershipTileViewModel,
} from '@/lib/wizardLeadershipContract'

type WizardLeadershipStepProps = {
  actionSlug: string
  municipalityId: number
  municipalityName: string
  municipalitySlug: string
  entryAction?: CampaignWizardActionId
  initialTiles: WizardLeadershipTileViewModel[]
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
}: WizardLeadershipStepProps) => {
  const router = useRouter()
  const [isContinuing, startContinueTransition] = useTransition()
  const [mode, setMode] = useState<WizardLeadershipMode>({ kind: 'grid' })
  const [dirty, setDirty] = useState(false)
  const [infoTile, setInfoTile] = useState<WizardLeadershipTileViewModel | null>(null)

  const showSkip = showLeadershipWizardSkip(entryAction)

  const skip = showSkip
    ? { label: WIZARD_LEADERSHIP_SKIP_LABEL, href: CAMPAIGN_HOME }
    : undefined

  const stepTitle =
    mode.kind === 'grid'
      ? WIZARD_LEADERSHIP_GRID_TITLE
      : mode.leadership
        ? WIZARD_LEADERSHIP_FORM_EDIT_TITLE
        : WIZARD_LEADERSHIP_FORM_CREATE_TITLE

  const trailingAction = showSkip ? (
    <Button variant="ghost" size="sm" className="min-h-11 px-2 text-sm" asChild>
      <Link href={CAMPAIGN_HOME}>{WIZARD_LEADERSHIP_SKIP_LABEL}</Link>
    </Button>
  ) : undefined

  const handleSaved = useCallback(() => {
    setDirty(true)
    setMode({ kind: 'grid' })
    router.refresh()
    toast.success(WIZARD_LEADERSHIP_SAVED_TOAST)
  }, [router])

  const handleContinue = () => {
    startContinueTransition(() => {
      router.push(CAMPAIGN_HOME)
    })
  }

  const sortedTiles = useMemo(
    () => [...initialTiles].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [initialTiles],
  )

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      stepTitle={stepTitle}
      isEntryStep={false}
      previousHref={wizardActionHref(actionSlug)}
      dismissHref={CAMPAIGN_HOME}
      municipalityLabel={municipalityName}
      skip={skip}
      trailingAction={trailingAction}
    >
      {mode.kind === 'form' ? (
        <WizardLeadershipForm
          municipalityId={municipalityId}
          municipalitySlug={municipalitySlug}
          leadership={mode.leadership}
          onSaved={handleSaved}
          onCancel={() => setMode({ kind: 'grid' })}
        />
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-4">
            {sortedTiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{WIZARD_LEADERSHIP_EMPTY_GRID}</p>
            ) : null}
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {sortedTiles.map((tile) => (
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex aspect-square w-full flex-col rounded-xl border border-border bg-transparent p-3 text-left transition-colors',
            'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'pointer-coarse:hover:bg-transparent',
          )}
          onClick={onOpen}
        >
          <div className="flex items-start justify-between gap-1">
            <div className="max-w-[calc(100%-2rem)]">
              {tile.supportStatus ? <SupportStatusBadge status={tile.supportStatus} /> : null}
            </div>
            <span
              role="button"
              tabIndex={0}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                event.stopPropagation()
                onInfo()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onInfo()
                }
              }}
              aria-label={`Ver observação de ${tile.name}`}
            >
              <InfoIcon className="size-4" aria-hidden />
            </span>
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
  )
}
