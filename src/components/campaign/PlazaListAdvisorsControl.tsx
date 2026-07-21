'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { PlazaAdvisorAvatarStack } from '@/components/campaign/PlazaAdvisorAvatarStack'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { EligibleAdvisorOption, PlazaAdvisorSummary } from '@/utilities/plazaViewModels'

type PlazaListAdvisorsControlProps = {
  plazaID: number
  plazaSlug: string
  currentAdvisorIDs: number[]
  advisorNamesById: ReadonlyMap<number, PlazaAdvisorSummary>
  options: EligibleAdvisorOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const PlazaListAdvisorsControl = ({
  plazaID,
  plazaSlug,
  currentAdvisorIDs,
  advisorNamesById,
  options,
  formAction,
}: PlazaListAdvisorsControlProps) => {
  const [open, setOpen] = useState(false)
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const currentSet = new Set(currentAdvisorIDs)

  const names = currentAdvisorIDs.flatMap((id) => {
    const advisor = advisorNamesById.get(id)
    return advisor ? [{ id: advisor.id, name: advisor.name }] : []
  })

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
          aria-label="Editar assessores"
        >
          {names.length ? (
            <PlazaAdvisorAvatarStack advisors={names} />
          ) : (
            <span className="text-muted-foreground">Sem assessor</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form action={submitAction} className="flex flex-col gap-3">
          <input type="hidden" name="plazaId" value={plazaID} />
          <input type="hidden" name="plazaSlug" value={plazaSlug} />
          <p className="text-sm text-muted-foreground">
            O assessor vê e gerencia somente as Praças que administra.
          </p>
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {options.map((option) => (
              <li key={option.id}>
                <Label
                  htmlFor={`plaza-list-advisor-${plazaID}-${option.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-accent"
                >
                  <Checkbox
                    id={`plaza-list-advisor-${plazaID}-${option.id}`}
                    name="advisors"
                    value={String(option.id)}
                    defaultChecked={currentSet.has(option.id)}
                  />
                  <span>
                    {option.name}
                    {option.isCurrent ? ' (você)' : ''}
                  </span>
                </Label>
              </li>
            ))}
          </ul>
          {state.message && state.status !== 'success' ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={isPending} className="min-h-11 w-full">
            {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Salvar assessores
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
