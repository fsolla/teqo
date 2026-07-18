'use client'

import { AlertCircleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'

export const LazyDialogModuleFallback = ({
  description,
  loadingLabel,
  onRetry,
  status,
  title,
}: {
  description: string
  loadingLabel: string
  onRetry: () => void
  status: 'idle' | 'loading' | 'error'
  title: string
}) => (
  <DialogContent showCloseButton={status !== 'error'}>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    {status === 'error' ? (
      <>
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Conteúdo indisponível</AlertTitle>
          <AlertDescription>Não foi possível carregar este conteúdo.</AlertDescription>
        </Alert>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
          <Button type="button" onClick={onRetry}>
            Tentar novamente
          </Button>
        </DialogFooter>
      </>
    ) : (
      <div className="flex min-h-24 items-center justify-center" aria-label={loadingLabel}>
        <Spinner aria-hidden="true" />
      </div>
    )}
  </DialogContent>
)
