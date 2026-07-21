'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { politicalTrendBadgeVariant, politicalTrendLabels } from '@/utilities/plazaUi'
import type { PlazaPoliticalTrendViewModel } from '@/utilities/plazaViewModels'

type PlazaListTrendControlProps = {
  plazaID: number
  status: PlazaPoliticalTrendViewModel['status']
  trendNote: string | null
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const PlazaListTrendControl = ({
  plazaID,
  status,
  trendNote,
  formAction,
}: PlazaListTrendControlProps) => {
  const [open, setOpen] = useState(false)
  const [state, submitAction, isPending] = useActionState(formAction, {})

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    setOpen(false)
  }, [state.message, state.status])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-h-11 rounded-md px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Editar tendência política"
        >
          {status ? (
            <Badge variant={politicalTrendBadgeVariant[status]}>{politicalTrendLabels[status]}</Badge>
          ) : (
            <Badge variant="outline">Não registrada</Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form action={submitAction} className="flex flex-col gap-3">
          <input type="hidden" name="plazaId" value={plazaID} />
          <input type="hidden" name="trendNote" value={trendNote ?? ''} />
          <Field>
            <FieldLabel htmlFor={`plaza-list-trend-${plazaID}`}>Tendência</FieldLabel>
            <NativeSelect
              id={`plaza-list-trend-${plazaID}`}
              name="trendStatus"
              defaultValue={status ?? ''}
              className="min-h-11 w-full"
            >
              <NativeSelectOption value="">Não registrada</NativeSelectOption>
              {(Object.keys(politicalTrendLabels) as Array<keyof typeof politicalTrendLabels>).map(
                (trendStatus) => (
                  <NativeSelectOption key={trendStatus} value={trendStatus}>
                    {politicalTrendLabels[trendStatus]}
                  </NativeSelectOption>
                ),
              )}
            </NativeSelect>
          </Field>
          {state.message && state.status !== 'success' ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={isPending} className="min-h-11 w-full">
            {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Salvar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
