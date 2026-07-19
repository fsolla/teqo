'use client'

import { useState, type ComponentProps } from 'react'
import { PencilIcon } from 'lucide-react'

import { LazyDialogModuleFallback } from '@/components/campaign/LazyDialogModuleFallback'
import { useLazyDialogModule } from '@/components/campaign/useLazyDialogModule'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import type {
  NucleusPrimaryContactPageData,
  PrimaryContactOption,
} from '@/utilities/primaryContactPageData'
import type { StaffNucleusTabsViewModel } from '@/utilities/nucleusViewModels'

import type { NucleusIntelligenceDialog } from './NucleusIntelligenceDialog'

type IntelligenceDialogComponent = typeof NucleusIntelligenceDialog
type IntelligenceDialogModule = { default: IntelligenceDialogComponent }

const loadNucleusIntelligenceDialog = (): Promise<IntelligenceDialogModule> =>
  import('./NucleusIntelligenceDialog').then((module) => ({
    default: module.NucleusIntelligenceDialog,
  }))

export const NucleusIntelligenceDialogShell = ({
  loadDialogModule = loadNucleusIntelligenceDialog,
  ...dialogProps
}: {
  action?: ComponentProps<IntelligenceDialogComponent>['action']
  nucleusId: number
  intelligence: Pick<
    StaffNucleusTabsViewModel,
    'strengths' | 'risks' | 'voterProfiles' | 'ticketAlliance' | 'dobradinhaNotes' | 'nextSteps'
  >
  primaryContact: PrimaryContactOption | null
  searchPrimaryContacts: (query: string) => Promise<NucleusPrimaryContactPageData>
  loadDialogModule?: () => Promise<IntelligenceDialogModule>
}) => {
  const [activated, setActivated] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
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
        <Button type="button" variant="outline" className="min-h-11">
          <PencilIcon data-icon="inline-start" aria-hidden="true" />
          Editar inteligência
        </Button>
      </DialogTrigger>
      {activated ? (
        DialogComponent ? (
          <DialogComponent
            {...dialogProps}
            onClose={closeDialog}
            onPendingChange={setMutationPending}
          />
        ) : (
          <LazyDialogModuleFallback
            description="Registre a leitura política e o contato de referência deste território."
            loadingLabel="Carregando editor"
            onRetry={load}
            status={status === 'ready' ? 'loading' : status}
            title="Editar inteligência do núcleo"
          />
        )
      ) : null}
    </Dialog>
  )
}
