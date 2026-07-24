'use client'

import { useActionState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { EligibleAdvisorOption } from '@/utilities/municipalityViewModels'

type MunicipalityAdvisorsFormProps = {
  municipalityID: number
  municipalitySlug: string
  currentAdvisorIDs: number[]
  options: EligibleAdvisorOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Coordinator-only: assign the advisors responsible for this municipality. */
export const MunicipalityAdvisorsForm = ({
  municipalityID,
  municipalitySlug,
  currentAdvisorIDs,
  options,
  formAction,
}: MunicipalityAdvisorsFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const currentSet = new Set(currentAdvisorIDs)

  return (
    <form action={submitAction} className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Assessores da Praça</h2>
        <p className="text-sm text-muted-foreground">
          O assessor vê e gerencia somente as Praças que administra.
        </p>
      </div>
      <input type="hidden" name="municipalityId" value={municipalityID} />
      <input type="hidden" name="municipalitySlug" value={municipalitySlug} />
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {options.map((option) => (
          <li key={option.id}>
            <Label
              htmlFor={`municipality-advisor-${option.id}`}
              className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-accent"
            >
              <Checkbox
                id={`municipality-advisor-${option.id}`}
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
      {state.status === 'success' ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar assessores
      </Button>
    </form>
  )
}
