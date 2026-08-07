'use client'

import { useActionState, useState } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { MunicipalityUpdatePolarity } from '@/lib/schemas/municipalityUpdate'
import { municipalityUpdatePolarityLabels } from '@/lib/schemas/municipalityUpdate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type MunicipalityUpdateFormProps = {
  municipalityID: number
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  isStaff: boolean
}

export const MunicipalityUpdateForm = ({
  municipalityID,
  formAction,
  isStaff,
}: MunicipalityUpdateFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [polarity, setPolarity] = useState<MunicipalityUpdatePolarity>('neutra')

  return (
    <form action={submitAction} className="flex flex-col gap-4 rounded-xl border p-4">
      <h3 className="text-base font-medium">Registrar atualização</h3>
      <input type="hidden" name="municipalityId" value={municipalityID} />

      <Field>
        <FieldLabel htmlFor="municipality-update-body">Texto da atualização</FieldLabel>
        <FieldDescription>Descreva o que aconteceu de forma clara e objetiva.</FieldDescription>
        <Textarea
          id="municipality-update-body"
          name="body"
          rows={4}
          maxLength={5000}
          required
          disabled={isPending}
        />
        {state.fieldErrors?.body ? <FieldError>{state.fieldErrors.body}</FieldError> : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="municipality-update-polarity">Polaridade</FieldLabel>
        <NativeSelect
          id="municipality-update-polarity"
          name="polarity"
          value={polarity}
          onChange={(event) => setPolarity(event.target.value as MunicipalityUpdatePolarity)}
          required
          disabled={isPending}
          className="w-48"
        >
          {(['boa', 'neutra', 'ruim'] as const).map((option) => (
            <NativeSelectOption key={option} value={option}>
              {municipalityUpdatePolarityLabels[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>Selecione a polaridade do fato observado.</FieldDescription>
      </Field>

      <div className="flex items-center gap-3">
        <input type="hidden" name="urgent" value="false" />
        <Checkbox
          id="municipality-update-urgent"
          name="urgent"
          value="true"
          defaultChecked={false}
          disabled={isPending}
        />
        <FieldLabel htmlFor="municipality-update-urgent" className="font-normal">
          Sinalizar como urgente
        </FieldLabel>
      </div>

      {isStaff ? (
        <div className="flex items-start gap-3">
          <input type="hidden" name="adversarySignal" value="false" />
          <Checkbox
            id="municipality-update-adversary"
            name="adversarySignal"
            value="true"
            defaultChecked={false}
            disabled={isPending}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="municipality-update-adversary" className="font-normal">
              Sinalizar adversário
            </FieldLabel>
            <FieldDescription>
              Marque se este é um fato relacionado a um adversário político.
            </FieldDescription>
          </div>
        </div>
      ) : (
        <input type="hidden" name="adversarySignal" value="false" />
      )}

      <CampaignFormActionMessage state={state} successFallbackMessage="Atualização registrada." />
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Registrar atualização
      </Button>
    </form>
  )
}
