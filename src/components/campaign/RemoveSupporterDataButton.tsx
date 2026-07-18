'use client'

import { useActionState } from 'react'

import type { SupporterRemoveFormState } from '@/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions'
import { removeSupporterDataFormAction } from '@/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'

export const RemoveSupporterDataButton = ({ supporterId }: { supporterId: number }) => {
  const [state, formAction, pending] = useActionState<
    SupporterRemoveFormState,
    FormData
  >(removeSupporterDataFormAction, {})

  return (
    <section className="rounded-[6px] border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="font-medium text-destructive">Remover meus dados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Exercício do direito de eliminação (LGPD art. 18). Remove o cadastro de apoiador e anonimiza
        o contato quando não houver outros vínculos.
      </p>
      {state.message ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <form action={formAction} className="mt-4">
        <input type="hidden" name="id" value={supporterId} />
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11"
          disabled={pending}
          onClick={(event) => {
            if (
              !window.confirm(
                'Confirma a remoção dos dados deste apoiador? Esta ação não pode ser desfeita.',
              )
            ) {
              event.preventDefault()
            }
          }}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? 'Removendo…' : 'Remover dados'}
        </Button>
      </form>
    </section>
  )
}
