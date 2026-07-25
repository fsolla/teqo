'use client'

import { useActionState } from 'react'

import type { SupporterRemoveFormState } from '@/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions'
import { removeSupporterDataFormAction } from '@/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions'
import { Alert, AlertDescription } from '@/components/ui/Alert'
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

export const RemoveSupporterDataButton = ({ supporterId }: { supporterId: number }) => {
  const [state, formAction, pending] = useActionState<SupporterRemoveFormState, FormData>(
    removeSupporterDataFormAction,
    {},
  )

  return (
    <section className="rounded-[6px] border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="font-medium text-destructive">Remover meus dados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Exercício do direito de eliminação (LGPD art. 18). Remove o cadastro de apoiador e anonimiza
        o contato quando não houver outros vínculos.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" className="mt-4 min-h-11">
            Remover dados
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover os dados deste apoiador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cadastro de apoiador será removido e o contato
              anonimizado quando não houver outros vínculos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.message ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="id" value={supporterId} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button" className="min-h-11" disabled={pending}>
                Cancelar
              </AlertDialogCancel>
              <Button type="submit" variant="destructive" className="min-h-11" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? 'Removendo…' : 'Confirmar remoção'}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
