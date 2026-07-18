'use client'

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangleIcon, UserRoundCogIcon } from 'lucide-react'

import type { CoordinatorAssignmentFormState } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/coordinatorAssignmentFormActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import type { AssignedCoordinatorViewModel } from '@/utilities/nucleusCoordinatorAssignmentPageData'
import type { NucleusCoordinatorOption } from '@/utilities/nucleusCoordinatorOptions'

type CoordinatorAssignmentDialogBodyModule = {
  default: typeof import('./CoordinatorAssignmentDialogBody').CoordinatorAssignmentDialogBody
}

const loadCoordinatorAssignmentDialogBody = (): Promise<CoordinatorAssignmentDialogBodyModule> =>
  import('./CoordinatorAssignmentDialogBody').then((module) => ({
    default: module.CoordinatorAssignmentDialogBody,
  }))

export type CoordinatorAssignmentFormAction = (
  state: CoordinatorAssignmentFormState,
  formData: FormData,
) => Promise<CoordinatorAssignmentFormState>

export type CoordinatorAssignmentOptionsResult = {
  expectedUpdatedAt: string
  options: NucleusCoordinatorOption[]
}

type CoordinatorAssignmentOptionsAction = () => Promise<CoordinatorAssignmentOptionsResult>

export const CoordinatorAssignmentDialog = ({
  action,
  coordinators,
  initialOpen = false,
  loadBodyModule = loadCoordinatorAssignmentDialogBody,
  loadOptions,
}: {
  action: CoordinatorAssignmentFormAction
  coordinators: AssignedCoordinatorViewModel[]
  initialOpen?: boolean
  loadBodyModule?: () => Promise<CoordinatorAssignmentDialogBodyModule>
  loadOptions: CoordinatorAssignmentOptionsAction
}) => {
  const [open, setOpen] = useState(initialOpen)
  const [result, setResult] = useState<CoordinatorAssignmentOptionsResult | null>(null)
  const [error, setError] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const requestId = useRef(0)
  const LazyBody = useMemo(() => lazy(loadBodyModule), [loadBodyModule])
  const triggerLabel = coordinators.length ? 'Alterar coordenadores' : 'Designar coordenadores'

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setResult(null)
    setError(false)
    try {
      const [, nextResult] = await Promise.all([loadBodyModule(), loadOptions()])
      if (requestId.current === currentRequest) setResult(nextResult)
    } catch {
      if (requestId.current === currentRequest) setError(true)
    }
  }, [loadBodyModule, loadOptions])

  useEffect(() => {
    if (open) void load()
    return () => {
      requestId.current += 1
    }
  }, [load, open])

  const closeDialog = () => {
    requestId.current += 1
    setResult(null)
    setError(false)
    setMutationPending(false)
    setOpen(false)
  }

  const setDialogOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (mutationPending) return
      closeDialog()
      return
    }
    setOpen(true)
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          <UserRoundCogIcon data-icon="inline-start" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!mutationPending}
        onEscapeKeyDown={(event) => {
          if (mutationPending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (mutationPending) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
          <DialogDescription>
            Selecione zero ou mais pessoas. Salvar sem seleção deixa o núcleo sem cobertura.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertTriangleIcon aria-hidden="true" />
            <AlertTitle>Não foi possível carregar</AlertTitle>
            <AlertDescription>Atualize as opções antes de alterar a coordenação.</AlertDescription>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => void load()}
            >
              Tentar novamente
            </Button>
          </Alert>
        ) : result ? (
          <Suspense
            fallback={
              <div
                className="flex min-h-24 items-center justify-center"
                aria-label="Carregando seletor"
              >
                <Spinner aria-hidden="true" />
              </div>
            }
          >
            <LazyBody
              key={result.expectedUpdatedAt}
              action={action}
              initialSelectedIds={coordinators.map(({ id }) => id)}
              onClose={closeDialog}
              onPendingChange={setMutationPending}
              result={result}
            />
          </Suspense>
        ) : (
          <div
            className="flex min-h-24 items-center justify-center"
            aria-label="Carregando coordenadores"
          >
            <Spinner aria-hidden="true" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
