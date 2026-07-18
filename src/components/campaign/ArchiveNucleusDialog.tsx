'use client'

import { useActionState } from 'react'
import { ArchiveIcon } from 'lucide-react'

import { archiveNucleusFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/formActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/AlertDialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'

export const ArchiveNucleusDialog = ({ nucleusId }: { nucleusId: number }) => {
  const [state, action, pending] = useActionState(archiveNucleusFormAction, {})

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" className="min-h-11">
          <ArchiveIcon data-icon="inline-start" aria-hidden="true" />
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar este núcleo?</AlertDialogTitle>
          <AlertDialogDescription>
            O núcleo sairá das listas ativas. Os dados permanecem preservados no sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertTitle>Não foi possível arquivar</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <form action={action}>
          <input type="hidden" name="id" value={nucleusId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="min-h-11" disabled={pending}>
              Cancelar
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" className="min-h-11" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? 'Arquivando…' : 'Confirmar arquivamento'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
