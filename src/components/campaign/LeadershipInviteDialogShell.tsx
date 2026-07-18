'use client'

import { useState } from 'react'
import { MessageCircleIcon } from 'lucide-react'

import { LazyDialogModuleFallback } from '@/components/campaign/LazyDialogModuleFallback'
import type { SupportStatus } from '@/components/campaign/SupportStatusBadge'
import { useLazyDialogModule } from '@/components/campaign/useLazyDialogModule'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

type LeadershipInviteDialogModule = {
  default: typeof import('./LeadershipInviteDialog').LeadershipInviteDialog
}

const loadLeadershipInviteDialog = (): Promise<LeadershipInviteDialogModule> =>
  import('./LeadershipInviteDialog').then((module) => ({
    default: module.LeadershipInviteDialog,
  }))

export const LeadershipInviteDialogShell = ({
  consentConfigured,
  leadershipId,
  loadDialogModule = loadLeadershipInviteDialog,
  supportStatus,
}: {
  consentConfigured: boolean
  leadershipId: number
  loadDialogModule?: () => Promise<LeadershipInviteDialogModule>
  supportStatus: SupportStatus
}) => {
  const [activated, setActivated] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const canInvite = consentConfigured
  const {
    component: DialogComponent,
    load,
    resetAfterClose,
    status,
  } = useLazyDialogModule(loadDialogModule)

  const openDialog = () => {
    setActivated(true)
    load()
  }

  const closeDialog = () => {
    setActivated(false)
    setMutationPending(false)
    resetAfterClose()
  }

  return (
    <div className="flex flex-col gap-1">
      <Dialog
        open={activated}
        onOpenChange={(open) => {
          if (!open && mutationPending) return
          if (open) {
            openDialog()
            return
          }
          closeDialog()
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" className="min-h-11" disabled={!canInvite}>
            <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
            Convidar pelo WhatsApp
          </Button>
        </DialogTrigger>
        {activated ? (
          DialogComponent ? (
            <DialogComponent
              consentConfigured={consentConfigured}
              leadershipId={leadershipId}
              supportStatus={supportStatus}
              onPendingChange={setMutationPending}
            />
          ) : (
            <LazyDialogModuleFallback
              description="Escolha o tipo de convite. Você enviará a mensagem pelo seu próprio WhatsApp."
              loadingLabel="Carregando convite"
              onRetry={load}
              status={status === 'ready' ? 'loading' : status}
              title="Convidar pelo WhatsApp"
            />
          )
        ) : null}
      </Dialog>
      {!consentConfigured ? (
        <p className="text-center text-xs text-muted-foreground">
          Consentimento ainda não configurado.
        </p>
      ) : null}
    </div>
  )
}
