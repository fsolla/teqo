'use client'

import { CheckIcon, InfoIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import type { LeadershipListSupportStatusResponse } from '@/app/(campaign)/campanha/(app)/liderancas/support-status/types'
import { declareVotesWizardFormAction } from '@/app/(campaign)/campanha/(app)/acoes/wizardLeadershipFormActions'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { WizardLeadershipForm } from '@/components/campaign/leadership/WizardLeadershipForm'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { recordLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import {
  WIZARD_LEADERSHIP_ADD_TILE_LABEL,
  WIZARD_LEADERSHIP_CONTINUE_LABEL,
  WIZARD_LEADERSHIP_DECLARE_VOTES_LABEL,
  WIZARD_LEADERSHIP_EMPTY_GRID,
  WIZARD_LEADERSHIP_EMPTY_NOTES,
  WIZARD_LEADERSHIP_FORM_CREATE_TITLE,
  WIZARD_LEADERSHIP_FORM_EDIT_TITLE,
  WIZARD_LEADERSHIP_GRID_TITLE,
  WIZARD_LEADERSHIP_SAVED_TOAST,
  WIZARD_LEADERSHIP_STATUS_DRAWER_TITLE,
  WIZARD_LEADERSHIP_STATUS_PENDING,
  WIZARD_LEADERSHIP_STATUS_SAVE_ERROR,
  WIZARD_LEADERSHIP_VOTES_DRAWER_TITLE,
  WIZARD_LEADERSHIP_VOTES_PENDING,
  WIZARD_LEADERSHIP_VOTES_SAVED,
  wizardFlowTitleForSlug,
} from '@/lib/campaignWizardCopy'
import { truncateNameAtWordBoundary } from '@/lib/leadershipNameTruncate'
import {
  isSupportStatus,
  leadershipSupportStatuses,
  type SupportStatus,
} from '@/lib/schemas/leadership'
import { cn } from '@/lib/utils'
import { fieldError } from '@/utilities/campaignFormFields'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'
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

const SUPPORT_STATUS_ENDPOINT = '/campanha/liderancas/support-status'
const DEFAULT_STATUS: SupportStatus = 'a_abordar'

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

const drawerContextLabel = (tile: WizardLeadershipTileViewModel, municipalityName: string): string =>
  `${tile.name} · ${municipalityName}`

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
  const [tiles, setTiles] = useState(initialTiles)
  const [infoTile, setInfoTile] = useState<WizardLeadershipTileViewModel | null>(null)
  const [statusTile, setStatusTile] = useState<WizardLeadershipTileViewModel | null>(null)
  const [votesTile, setVotesTile] = useState<WizardLeadershipTileViewModel | null>(null)

  useEffect(() => {
    setTiles(initialTiles)
  }, [initialTiles])

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

  const markDirtyAndRefresh = useCallback(() => {
    recordLastActedMunicipality(municipalitySlug)
    setDirty(true)
    router.refresh()
  }, [municipalitySlug, router])

  const handlePopFormLayer = useCallback(() => {
    setMode({ kind: 'grid' })
  }, [])

  const handleSaved = useCallback(() => {
    markDirtyAndRefresh()
    setMode({ kind: 'grid' })
    toast.success(WIZARD_LEADERSHIP_SAVED_TOAST)
  }, [markDirtyAndRefresh])

  const handleStatusSaved = useCallback(
    (leadershipId: number, supportStatus: SupportStatus) => {
      setTiles((current) =>
        current.map((tile) => (tile.id === leadershipId ? { ...tile, supportStatus } : tile)),
      )
      setStatusTile(null)
      markDirtyAndRefresh()
    },
    [markDirtyAndRefresh],
  )

  const handleVotesSaved = useCallback(
    (leadershipId: number, declaredVotes: number) => {
      setTiles((current) =>
        current.map((tile) => (tile.id === leadershipId ? { ...tile, declaredVotes } : tile)),
      )
      setVotesTile(null)
      markDirtyAndRefresh()
    },
    [markDirtyAndRefresh],
  )

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
            {tiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{WIZARD_LEADERSHIP_EMPTY_GRID}</p>
            ) : null}
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {tiles.map((tile) => (
                <li key={tile.id}>
                  <LeadershipTileButton
                    tile={tile}
                    onOpen={() => setMode({ kind: 'form', leadership: tile })}
                    onInfo={() => setInfoTile(tile)}
                    onStatus={() => setStatusTile(tile)}
                    onVotes={() => setVotesTile(tile)}
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

      <WizardLeadershipStatusDrawer
        tile={statusTile}
        municipalityName={municipalityName}
        onClose={() => setStatusTile(null)}
        onSaved={handleStatusSaved}
      />

      <WizardLeadershipVotesDrawer
        tile={votesTile}
        municipalityId={municipalityId}
        municipalityName={municipalityName}
        onClose={() => setVotesTile(null)}
        onSaved={handleVotesSaved}
      />
    </CampaignWizardShell>
  )
}

type LeadershipTileButtonProps = {
  tile: WizardLeadershipTileViewModel
  onOpen: () => void
  onInfo: () => void
  onStatus: () => void
  onVotes: () => void
}

const LeadershipTileButton = ({
  tile,
  onOpen,
  onInfo,
  onStatus,
  onVotes,
}: LeadershipTileButtonProps) => {
  const secondary = secondaryContact(tile)
  const noteText = notesLabel(tile.notes)
  const status = tile.supportStatus ?? DEFAULT_STATUS
  const showDeclareVotesWarning = tile.declaredVotes === 0

  return (
    <div className="relative aspect-square w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex h-full w-full flex-col rounded-xl border border-border bg-transparent transition-colors',
              'pointer-coarse:hover:bg-transparent',
            )}
          >
            <div className="flex items-start justify-between gap-2 p-3 pb-0">
              <button
                type="button"
                className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation()
                  onStatus()
                }}
                aria-label={`Editar status de apoio — ${supportStatusLabels[status]}`}
              >
                <SupportStatusBadge status={status} />
              </button>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation()
                  onInfo()
                }}
                aria-label={`Ver observação de ${tile.name}`}
              >
                <InfoIcon className="size-4" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              className="flex flex-1 flex-col px-3 pt-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onOpen}
            >
              <p className="text-sm font-medium leading-snug text-foreground">
                {truncateNameAtWordBoundary(tile.name, 28)}
              </p>
            </button>
            <div className="px-3">
              <button
                type="button"
                className="min-h-8 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation()
                  onVotes()
                }}
                aria-label={
                  showDeclareVotesWarning
                    ? `Declarar votos de ${tile.name}`
                    : `${tile.declaredVotes} votos declarados de ${tile.name}`
                }
              >
                {showDeclareVotesWarning ? (
                  <Badge variant="estimate-pending" className="gap-1">
                    <TriangleAlertIcon aria-hidden />
                    {WIZARD_LEADERSHIP_DECLARE_VOTES_LABEL}
                  </Badge>
                ) : (
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {tile.declaredVotes}
                  </span>
                )}
              </button>
            </div>
            <button
              type="button"
              className="mt-auto flex flex-col gap-1 px-3 pb-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onOpen}
            >
              {secondary ? (
                <p className="truncate text-xs text-muted-foreground">{secondary}</p>
              ) : null}
              {!tile.exclusive ? (
                <Badge variant="outline" className="mt-1 w-fit text-xs">
                  Não exclusivo
                </Badge>
              ) : null}
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent className="pointer-coarse:hidden max-w-xs whitespace-pre-wrap">
          {noteText}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

type WizardLeadershipStatusDrawerProps = {
  tile: WizardLeadershipTileViewModel | null
  municipalityName: string
  onClose: () => void
  onSaved: (leadershipId: number, supportStatus: SupportStatus) => void
}

const WizardLeadershipStatusDrawer = ({
  tile,
  municipalityName,
  onClose,
  onSaved,
}: WizardLeadershipStatusDrawerProps) => {
  const [pendingStatus, setPendingStatus] = useState<SupportStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (tile === null) {
      setPendingStatus(null)
      setErrorMessage(null)
    }
  }, [tile])

  const currentStatus = tile?.supportStatus ?? DEFAULT_STATUS

  const handleSelect = async (nextStatus: SupportStatus) => {
    if (tile === null || nextStatus === currentStatus || pendingStatus !== null) return

    setPendingStatus(nextStatus)
    setErrorMessage(null)

    const { ok, payload } = await postCampaignJson<LeadershipListSupportStatusResponse>(
      SUPPORT_STATUS_ENDPOINT,
      { leadershipId: tile.id, supportStatus: nextStatus },
    )

    if (!ok || payload.status !== 'success') {
      setPendingStatus(null)
      setErrorMessage(
        payload.status === 'error' ? payload.message : WIZARD_LEADERSHIP_STATUS_SAVE_ERROR,
      )
      return
    }

    if (!isSupportStatus(payload.savedSupportStatus)) {
      setPendingStatus(null)
      setErrorMessage(WIZARD_LEADERSHIP_STATUS_SAVE_ERROR)
      return
    }

    onSaved(tile.id, payload.savedSupportStatus)
    setPendingStatus(null)
  }

  const statusMessage = errorMessage
    ? errorMessage
    : pendingStatus !== null
      ? WIZARD_LEADERSHIP_STATUS_PENDING
      : ''

  return (
    <Drawer open={tile !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{WIZARD_LEADERSHIP_STATUS_DRAWER_TITLE}</DrawerTitle>
          <DrawerDescription>
            {tile ? drawerContextLabel(tile, municipalityName) : null}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-2 px-4 pb-6" aria-busy={pendingStatus !== null}>
          <p className="sr-only" aria-live="polite">
            {statusMessage}
          </p>
          <ul className="flex list-none flex-col gap-1">
            {leadershipSupportStatuses.map((option) => {
              const isCurrent = option === currentStatus
              const isPending = pendingStatus === option
              return (
                <li key={option}>
                  <button
                    type="button"
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition-colors',
                      'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isCurrent && 'bg-muted/60 font-medium',
                    )}
                    disabled={pendingStatus !== null}
                    onClick={() => void handleSelect(option)}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <span>{supportStatusLabels[option]}</span>
                    {isPending ? (
                      <Spinner className="size-4 text-muted-foreground" aria-hidden />
                    ) : isCurrent ? (
                      <CheckIcon className="size-4 text-muted-foreground" aria-hidden />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          {errorMessage ? (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

type WizardLeadershipVotesDrawerProps = {
  tile: WizardLeadershipTileViewModel | null
  municipalityId: number
  municipalityName: string
  onClose: () => void
  onSaved: (leadershipId: number, declaredVotes: number) => void
}

const WizardLeadershipVotesDrawer = ({
  tile,
  municipalityId,
  municipalityName,
  onClose,
  onSaved,
}: WizardLeadershipVotesDrawerProps) => {
  const [state, submitAction, isPending] = useActionState(declareVotesWizardFormAction, {})
  const [inputValue, setInputValue] = useState('')
  const handledMessageRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (tile !== null) {
      setInputValue(tile.declaredVotes > 0 ? String(tile.declaredVotes) : '')
      handledMessageRef.current = undefined
    }
  }, [tile])

  useEffect(() => {
    if (
      tile === null ||
      !state.message ||
      state.message === handledMessageRef.current ||
      state.fieldErrors
    ) {
      return
    }

    if (state.message === WIZARD_LEADERSHIP_VOTES_SAVED) {
      handledMessageRef.current = state.message
      const parsed = Number.parseInt(inputValue, 10)
      if (!Number.isNaN(parsed)) {
        onSaved(tile.id, parsed)
      }
    }
  }, [inputValue, onSaved, state.fieldErrors, state.message, tile])

  return (
    <Drawer open={tile !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{WIZARD_LEADERSHIP_VOTES_DRAWER_TITLE}</DrawerTitle>
          <DrawerDescription>
            {tile ? drawerContextLabel(tile, municipalityName) : null}
          </DrawerDescription>
        </DrawerHeader>
        <form action={submitAction} className="flex flex-col gap-3 px-4 pb-6" aria-busy={isPending}>
          <input type="hidden" name="municipalityId" value={municipalityId} />
          {tile !== null ? <input type="hidden" name="leadershipId" value={tile.id} /> : null}
          <p className="sr-only" aria-live="polite">
            {isPending ? WIZARD_LEADERSHIP_VOTES_PENDING : (state.message ?? '')}
          </p>
          <Field>
            <FieldLabel htmlFor="wizard-leadership-declared-votes">Votos declarados</FieldLabel>
            <Input
              id="wizard-leadership-declared-votes"
              name="declaredVotes"
              type="number"
              min={0}
              max={1000000}
              required
              inputMode="numeric"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="min-h-11"
              disabled={isPending}
            />
            {fieldError(state.fieldErrors, 'declaredVotes') ? (
              <FieldError>{fieldError(state.fieldErrors, 'declaredVotes')}</FieldError>
            ) : null}
          </Field>
          <Button type="submit" className="min-h-11" disabled={isPending}>
            {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Salvar
          </Button>
          <CampaignFormActionMessage
            state={state}
            successFallbackMessage={WIZARD_LEADERSHIP_VOTES_SAVED}
          />
        </form>
      </DrawerContent>
    </Drawer>
  )
}
