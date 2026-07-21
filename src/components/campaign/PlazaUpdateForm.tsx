'use client'

import { useActionState, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  plazaUpdateKindLabels,
  plazaUpdateKinds,
  type PlazaUpdateKind,
} from '@/lib/schemas/plazaUpdate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type PlazaUpdateFormProps = {
  plazaID: number
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const PlazaUpdateForm = ({ plazaID, formAction }: PlazaUpdateFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [kind, setKind] = useState<PlazaUpdateKind>('semanal')

  return (
    <form action={submitAction} className="flex flex-col gap-4 rounded-xl border p-4">
      <h3 className="text-base font-medium">Registrar atualização</h3>
      <input type="hidden" name="plazaId" value={plazaID} />
      <Field>
        <FieldLabel htmlFor="plaza-update-kind">Tipo</FieldLabel>
        <NativeSelect
          id="plaza-update-kind"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as PlazaUpdateKind)}
          className="min-h-11 w-full sm:w-56"
        >
          {plazaUpdateKinds.map((entry) => (
            <NativeSelectOption key={entry} value={entry}>
              {plazaUpdateKindLabels[entry]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {kind === 'semanal' ? (
        <>
          <Field>
            <FieldLabel htmlFor="plaza-update-worked">O que funcionou</FieldLabel>
            <Textarea id="plaza-update-worked" name="worked" rows={3} maxLength={3000} />
            {fieldError(state.fieldErrors, 'worked') ? (
              <FieldError>{fieldError(state.fieldErrors, 'worked')}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="plaza-update-failed">O que não funcionou</FieldLabel>
            <Textarea id="plaza-update-failed" name="failed" rows={3} maxLength={3000} />
            {fieldError(state.fieldErrors, 'failed') ? (
              <FieldError>{fieldError(state.fieldErrors, 'failed')}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="plaza-update-needs">O que preciso</FieldLabel>
            <Textarea id="plaza-update-needs" name="needs" rows={3} maxLength={3000} />
            {fieldError(state.fieldErrors, 'needs') ? (
              <FieldError>{fieldError(state.fieldErrors, 'needs')}</FieldError>
            ) : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="plaza-update-volunteers">Voluntários ativos</FieldLabel>
              <Input
                id="plaza-update-volunteers"
                name="activeVolunteers"
                type="number"
                min={0}
                inputMode="numeric"
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="plaza-update-supports">Novos apoios</FieldLabel>
              <Input
                id="plaza-update-supports"
                name="newSupports"
                type="number"
                min={0}
                inputMode="numeric"
                className="min-h-11"
              />
            </Field>
          </div>
        </>
      ) : (
        <Field>
          <FieldLabel htmlFor="plaza-update-body">Texto</FieldLabel>
          <Textarea id="plaza-update-body" name="body" rows={4} maxLength={5000} />
          {fieldError(state.fieldErrors, 'body') ? (
            <FieldError>{fieldError(state.fieldErrors, 'body')}</FieldError>
          ) : null}
        </Field>
      )}
      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === 'success' ? (
        <Alert>
          <AlertDescription>{state.message ?? 'Atualização registrada.'}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Registrar atualização
      </Button>
    </form>
  )
}
