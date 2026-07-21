'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { StaffPlazaVotesDisplay } from '@/components/campaign/StaffPlazaVotesDisplay'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type PlazaListExpectedVotesControlProps = {
  plazaID: number
  expectedVotes: number | null
  leadershipEffectiveTotal: number
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const PlazaListExpectedVotesControl = ({
  plazaID,
  expectedVotes,
  leadershipEffectiveTotal,
  formAction,
}: PlazaListExpectedVotesControlProps) => {
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
          className="min-h-11 rounded-md px-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Editar votos estimados"
        >
          <StaffPlazaVotesDisplay
            expectedVotes={expectedVotes}
            leadershipEffectiveTotal={leadershipEffectiveTotal}
            valueClassName="font-medium tabular-nums"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form action={submitAction} className="flex flex-col gap-3">
          <input type="hidden" name="plazaId" value={plazaID} />
          <Field>
            <FieldLabel htmlFor={`plaza-list-expected-votes-${plazaID}`}>Total da Praça</FieldLabel>
            <Input
              id={`plaza-list-expected-votes-${plazaID}`}
              name="expectedVotes"
              type="number"
              min={0}
              max={1_000_000}
              inputMode="numeric"
              defaultValue={expectedVotes ?? undefined}
              className="min-h-11"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
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
