'use client'

import { useCallback, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { CheckIcon, LightbulbIcon, PencilIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import type {
  VoteEstimateDialogMode,
  VoteEstimateFormAction,
} from '@/components/campaign/VoteEstimateDialog'
import {
  type VoteEstimateSuccessFocus,
  useVoteEstimateSuccessFocus,
} from '@/components/campaign/VoteEstimateFocusProvider'
import { LazyDialogModuleFallback } from '@/components/campaign/LazyDialogModuleFallback'
import { useLazyDialogModule } from '@/components/campaign/useLazyDialogModule'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import type { CampaignUser } from '@/payload-types'

type VoteEstimateDialogModule = {
  default: typeof import('./VoteEstimateDialog').VoteEstimateActionDialog
}

const loadVoteEstimateDialog = (): Promise<VoteEstimateDialogModule> =>
  import('./VoteEstimateDialog').then((module) => ({
    default: module.VoteEstimateActionDialog,
  }))

const triggerLabel = (mode: VoteEstimateDialogMode, hasConfirmedEstimate: boolean): string =>
  mode === 'review'
    ? 'Revisar sugestão'
    : mode === 'edit'
      ? 'Editar confirmada'
      : hasConfirmedEstimate
        ? 'Sugerir nova estimativa'
        : 'Sugerir estimativa'

const title = (mode: VoteEstimateDialogMode): string =>
  mode === 'review'
    ? 'Revisar sugestão de estimativa'
    : mode === 'edit'
      ? 'Editar estimativa confirmada'
      : 'Sugerir estimativa de votos'

export const VoteEstimateDialogShell = ({
  confirmAction,
  confirmedEstimate,
  confirmedEstimateRevision = null,
  fallbackFocusId = '',
  nucleusId,
  proposedEstimate,
  role,
  loadDialogModule = loadVoteEstimateDialog,
}: {
  confirmAction: VoteEstimateFormAction
  confirmedEstimate: number | null
  confirmedEstimateRevision?: string | null
  fallbackFocusId?: string
  nucleusId: number
  proposedEstimate: number | null
  role: CampaignUser['role']
  loadDialogModule?: () => Promise<VoteEstimateDialogModule>
}) => {
  const router = useRouter()
  const canConfirm = role === 'geral' || role === 'coordenador'
  const hasConfirmedEstimate = confirmedEstimate != null
  const [mode, setMode] = useState<VoteEstimateDialogMode | null>(null)
  const [open, setOpen] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const [refreshPending, startRefreshTransition] = useTransition()
  const localSuccessFocusRef = useRef<VoteEstimateSuccessFocus | null>(null)
  const sharedSuccessFocusRef = useVoteEstimateSuccessFocus()
  const pendingSuccessFocusRef = sharedSuccessFocusRef ?? localSuccessFocusRef
  const triggerRefs = useRef<Partial<Record<VoteEstimateDialogMode, HTMLButtonElement | null>>>({})
  const {
    component: DialogComponent,
    load,
    resetAfterClose,
    status,
  } = useLazyDialogModule(loadDialogModule)
  const openDialog = (nextMode: VoteEstimateDialogMode) => {
    pendingSuccessFocusRef.current = null
    setMode(nextMode)
    setOpen(true)
    load()
  }
  const closeDialog = useCallback(() => {
    if (mutationPending) return
    setOpen(false)
    setMutationPending(false)
    resetAfterClose()
  }, [mutationPending, resetAfterClose])
  const handlePendingChange = useCallback(
    (pending: boolean, pendingMode: VoteEstimateDialogMode, succeeded: boolean) => {
      setMutationPending(pending)
      if (pending) {
        pendingSuccessFocusRef.current = {
          confirmedEstimateRevision,
          mode: pendingMode,
          nucleusId,
        }
      } else if (!succeeded) {
        pendingSuccessFocusRef.current = null
      }
    },
    [confirmedEstimateRevision, nucleusId, pendingSuccessFocusRef],
  )
  const finishSuccess = useCallback(
    (successfulMode: VoteEstimateDialogMode) => {
      pendingSuccessFocusRef.current = {
        confirmedEstimateRevision,
        mode: successfulMode,
        nucleusId,
      }
      setMutationPending(false)
      setOpen(false)
      startRefreshTransition(() => router.refresh())
    },
    [confirmedEstimateRevision, nucleusId, pendingSuccessFocusRef, router],
  )
  const modes: VoteEstimateDialogMode[] =
    canConfirm && proposedEstimate != null
      ? ['review']
      : canConfirm && hasConfirmedEstimate
        ? ['suggest', 'edit']
        : ['suggest']

  useLayoutEffect(() => {
    const pendingFocus = pendingSuccessFocusRef.current
    if (!pendingFocus) return
    if (pendingFocus.nucleusId !== nucleusId) {
      pendingSuccessFocusRef.current = null
      return
    }
    if (open || mutationPending || refreshPending) return

    const targetMode: VoteEstimateDialogMode =
      pendingFocus.mode === 'suggest' ? (canConfirm ? 'review' : 'suggest') : 'edit'
    const refreshedStateIsReady =
      pendingFocus.mode === 'suggest'
        ? !canConfirm || proposedEstimate != null
        : proposedEstimate == null &&
          confirmedEstimate != null &&
          confirmedEstimateRevision !== pendingFocus.confirmedEstimateRevision
    if (!refreshedStateIsReady) return

    const focusTarget = triggerRefs.current[targetMode] ?? document.getElementById(fallbackFocusId)
    focusTarget?.focus()
    pendingSuccessFocusRef.current = null
  }, [
    canConfirm,
    confirmedEstimate,
    confirmedEstimateRevision,
    fallbackFocusId,
    mutationPending,
    nucleusId,
    open,
    pendingSuccessFocusRef,
    proposedEstimate,
    refreshPending,
  ])

  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((item) => (
        <Dialog
          key={item}
          open={open && mode === item}
          onOpenChange={(open) => {
            if (open) {
              openDialog(item)
              return
            }
            closeDialog()
          }}
        >
          <DialogTrigger asChild>
            <Button
              ref={(trigger) => {
                triggerRefs.current[item] = trigger
              }}
              data-vote-estimate-trigger={`${nucleusId}:${item}`}
              type="button"
              className="min-h-11"
              variant={item === 'review' ? 'default' : 'outline'}
            >
              {item === 'review' ? (
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
              ) : item === 'edit' ? (
                <PencilIcon data-icon="inline-start" aria-hidden="true" />
              ) : (
                <LightbulbIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {triggerLabel(item, hasConfirmedEstimate)}
            </Button>
          </DialogTrigger>
          {mode === item ? (
            DialogComponent ? (
              <DialogComponent
                confirmAction={confirmAction}
                hasConfirmedEstimate={hasConfirmedEstimate}
                initialEstimate={item === 'review' ? proposedEstimate : confirmedEstimate}
                mode={item}
                nucleusId={nucleusId}
                onPendingChange={handlePendingChange}
                onSuccessClose={finishSuccess}
                proposedEstimate={item === 'review' ? proposedEstimate : null}
              />
            ) : (
              <LazyDialogModuleFallback
                description="Carregando os campos da estimativa."
                loadingLabel="Carregando estimativa"
                onRetry={load}
                status={status === 'ready' ? 'loading' : status}
                title={title(item)}
              />
            )
          ) : null}
        </Dialog>
      ))}
    </div>
  )
}
