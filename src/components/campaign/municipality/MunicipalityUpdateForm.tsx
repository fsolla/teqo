'use client'

import { useActionState, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  municipalitySignalTypeDescriptions,
  municipalitySignalTypeLabels,
  municipalitySignalTypes,
  municipalityUpdateKindLabels,
  municipalityUpdateKinds,
  type MunicipalityUpdateKind,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'

type MunicipalityUpdateFormProps = {
  municipalityID: number
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const MunicipalityUpdateForm = ({
  municipalityID,
  formAction,
}: MunicipalityUpdateFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [kind, setKind] = useState<MunicipalityUpdateKind>('semanal')

  return (
    <form action={submitAction} className="flex flex-col gap-4 rounded-xl border p-4">
      <h3 className="text-base font-medium">Registrar atualização</h3>
      <input type="hidden" name="municipalityId" value={municipalityID} />
      <Field>
        <FieldLabel htmlFor="municipality-update-kind">Tipo</FieldLabel>
        <NativeSelect
          id="municipality-update-kind"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as MunicipalityUpdateKind)}
          className="min-h-11 w-full sm:w-56"
        >
          {municipalityUpdateKinds.map((entry) => (
            <NativeSelectOption key={entry} value={entry}>
              {municipalityUpdateKindLabels[entry]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {kind === 'semanal' ? (
        <>
          <Field>
            <FieldLabel htmlFor="municipality-update-worked">O que funcionou</FieldLabel>
            <Textarea id="municipality-update-worked" name="worked" rows={3} maxLength={3000} />
            {fieldError(state.fieldErrors, 'worked') ? (
              <FieldError>{fieldError(state.fieldErrors, 'worked')}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="municipality-update-failed">O que não funcionou</FieldLabel>
            <Textarea id="municipality-update-failed" name="failed" rows={3} maxLength={3000} />
            {fieldError(state.fieldErrors, 'failed') ? (
              <FieldError>{fieldError(state.fieldErrors, 'failed')}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="municipality-update-needs">O que preciso</FieldLabel>
            <Textarea id="municipality-update-needs" name="needs" rows={3} maxLength={3000} />
            {fieldError(state.fieldErrors, 'needs') ? (
              <FieldError>{fieldError(state.fieldErrors, 'needs')}</FieldError>
            ) : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="municipality-update-volunteers">Voluntários ativos</FieldLabel>
              <Input
                id="municipality-update-volunteers"
                name="activeVolunteers"
                type="number"
                min={0}
                inputMode="numeric"
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="municipality-update-supports">Novos apoios</FieldLabel>
              <Input
                id="municipality-update-supports"
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
        <>
          <Field>
            <FieldLabel htmlFor="municipality-update-body">Texto</FieldLabel>
            <Textarea
              id="municipality-update-body"
              name="body"
              rows={kind === 'sinal' ? 2 : 4}
              maxLength={5000}
            />
            {fieldError(state.fieldErrors, 'body') ? (
              <FieldError>{fieldError(state.fieldErrors, 'body')}</FieldError>
            ) : null}
          </Field>
          {kind === 'sinal' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="municipality-update-signal-type">Tipo do sinal</FieldLabel>
                  <NativeSelect
                    id="municipality-update-signal-type"
                    name="signalType"
                    defaultValue=""
                    required
                  >
                    <NativeSelectOption value="">Selecione</NativeSelectOption>
                    {municipalitySignalTypes.map((entry) => (
                      <NativeSelectOption key={entry} value={entry}>
                        {municipalitySignalTypeLabels[entry]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>Escolha o fato político observado:</FieldDescription>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {municipalitySignalTypes.map((entry) => (
                      <li key={entry}>
                        <span className="font-medium text-foreground">
                          {municipalitySignalTypeLabels[entry]}:
                        </span>{' '}
                        {municipalitySignalTypeDescriptions[entry]}
                      </li>
                    ))}
                  </ul>
                </Field>
                <Field>
                  <FieldLabel htmlFor="municipality-update-signal-source">Fonte</FieldLabel>
                  <Input
                    id="municipality-update-signal-source"
                    name="signalSource"
                    maxLength={160}
                    required
                  />
                </Field>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input name="triangulated" type="checkbox" className="size-4" />
                Triangulado — confirmado por mais de uma fonte independente
              </label>
            </>
          ) : null}
        </>
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
