'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { MunicipalityAdvisorAvatarStack } from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
} from '@/utilities/municipalityViewModels'

type MunicipalityListAdvisorsControlProps = {
  municipalityID: number
  municipalitySlug: string
  currentAdvisorIDs: number[]
  /** Raises the empty state to "Sem responsável" — see `MissingAdvisorBadge`. */
  isPriority: boolean
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  options: EligibleAdvisorOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const MunicipalityListAdvisorsControl = ({
  municipalityID,
  municipalitySlug,
  currentAdvisorIDs,
  isPriority,
  advisorNamesById,
  options,
  formAction,
}: MunicipalityListAdvisorsControlProps) => {
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
          <MunicipalityAdvisorAvatarStack advisors={names} isPriority={isPriority} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form action={submitAction} className="flex flex-col gap-3">
          <input type="hidden" name="municipalityId" value={municipalityID} />
          <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
          <p className="text-sm text-muted-foreground">
            O assessor vê e gerencia somente os municípios que administra.
          </p>
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {options.map((option) => (
              <li key={option.id}>
                <Label
                  htmlFor={`municipality-list-advisor-${municipalityID}-${option.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-accent"
                >
                  <Checkbox
                    id={`municipality-list-advisor-${municipalityID}-${option.id}`}
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
