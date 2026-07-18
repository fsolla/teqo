'use client'

import { useEffect, useState } from 'react'
import { ClipboardListIcon } from 'lucide-react'

import { LazyDialogModuleFallback } from '@/components/campaign/LazyDialogModuleFallback'
import type { NucleusUpdateFormAction } from '@/components/campaign/NucleusUpdateForm'
import { useLazyDialogModule } from '@/components/campaign/useLazyDialogModule'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

type NucleusUpdateFormModule = { default: typeof import('./NucleusUpdateForm').NucleusUpdateForm }

const loadNucleusUpdateForm = (): Promise<NucleusUpdateFormModule> =>
  import('./NucleusUpdateForm').then((module) => ({ default: module.NucleusUpdateForm }))

export const NucleusUpdateFormShell = ({
  action,
  defaultOpen = false,
  loadDialogModule = loadNucleusUpdateForm,
  nucleusId,
}: {
  action: NucleusUpdateFormAction
  defaultOpen?: boolean
  loadDialogModule?: () => Promise<NucleusUpdateFormModule>
  nucleusId: number
}) => {
  const [activated, setActivated] = useState(defaultOpen)
  const [mutationPending, setMutationPending] = useState(false)
  const {
    component: FormComponent,
    load,
    resetAfterClose,
    status,
  } = useLazyDialogModule(loadDialogModule)

  useEffect(() => {
    if (activated) load()
  }, [activated, load])

  const closeDialog = () => {
    setActivated(false)
    setMutationPending(false)
    resetAfterClose()
  }

  return (
    <Dialog
      open={activated}
      onOpenChange={(open) => {
        if (!open && mutationPending) return
        if (open) {
          setActivated(true)
          load()
          return
        }
        closeDialog()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="min-h-11">
          <ClipboardListIcon data-icon="inline-start" aria-hidden="true" />
          Nova atualização
        </Button>
      </DialogTrigger>
      {activated ? (
        FormComponent ? (
          <FormComponent
            action={action}
            nucleusId={nucleusId}
            onClose={closeDialog}
            onPendingChange={setMutationPending}
          />
        ) : (
          <LazyDialogModuleFallback
            description="Registre o pulso semanal ou uma informação urgente do núcleo."
            loadingLabel="Carregando formulário"
            onRetry={load}
            status={status === 'ready' ? 'loading' : status}
            title="Nova atualização"
          />
        )
      ) : null}
    </Dialog>
  )
}
