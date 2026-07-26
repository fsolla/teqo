'use client'

import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { useActionState } from 'react'

import {
  cancelActivityFormAction,
  markActivityRealizedFormAction,
} from '@/app/(campaign)/campanha/(app)/atividades/[slug]/lifecycleFormActions'
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

type LifecycleDialogProps = {
  activityId: number
}

export const CancelActivityDialog = ({ activityId }: LifecycleDialogProps) => {
  const [state, action, pending] = useActionState(cancelActivityFormAction, {})

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" className="min-h-11">
          <XCircleIcon data-icon="inline-start" aria-hidden="true" />
          Cancelar atividade
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta atividade?</AlertDialogTitle>
          <AlertDialogDescription>
            A atividade será marcada como cancelada. Os dados permanecem preservados no sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertTitle>Não foi possível cancelar</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <form action={action}>
          <input type="hidden" name="id" value={activityId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="min-h-11" disabled={pending}>
              Voltar
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" className="min-h-11" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? 'Cancelando…' : 'Confirmar cancelamento'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const MarkActivityRealizedDialog = ({ activityId }: LifecycleDialogProps) => {
  const [state, action, pending] = useActionState(markActivityRealizedFormAction, {})

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" className="min-h-11">
          <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
          Marcar como realizado
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Marcar esta atividade como realizada?</AlertDialogTitle>
          <AlertDialogDescription>
            Use esta ação após a execução da atividade. O status não poderá voltar a rascunho ou
            planejado por aqui.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.message ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertTitle>Não foi possível concluir</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <form action={action}>
          <input type="hidden" name="id" value={activityId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="min-h-11" disabled={pending}>
              Voltar
            </AlertDialogCancel>
            <Button type="submit" className="min-h-11" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? 'Salvando…' : 'Confirmar'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
