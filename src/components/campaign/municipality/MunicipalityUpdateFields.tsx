'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  municipalityUpdatePolarityLabels,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import { fieldError } from '@/utilities/campaignFormFields'

type MunicipalityUpdateFieldsProps = {
  idPrefix: string
  fieldErrors?: Record<string, string[]>
  isStaff: boolean
}

export const MunicipalityUpdateFields = ({
  idPrefix,
  fieldErrors,
  isStaff,
}: MunicipalityUpdateFieldsProps) => {
  const [polarity, setPolarity] = useState<MunicipalityUpdatePolarity>('neutra')
  const bodyId = `${idPrefix}-body`
  const polarityId = `${idPrefix}-polarity`
  const urgentId = `${idPrefix}-urgent`
  const adversaryId = `${idPrefix}-adversary`

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={bodyId}>Texto</FieldLabel>
        <FieldDescription>Descreva o que aconteceu de forma clara e objetiva.</FieldDescription>
        <Textarea
          id={bodyId}
          name="body"
          rows={3}
          maxLength={5000}
          required
          className="min-h-11"
          placeholder="Ex.: Reunião com líderes, nova adesão, perda de apoio..."
        />
        {fieldError(fieldErrors, 'body') ? (
          <FieldError>{fieldError(fieldErrors, 'body')}</FieldError>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={polarityId}>Polaridade</FieldLabel>
        <NativeSelect
          id={polarityId}
          name="polarity"
          value={polarity}
          onChange={(event) => setPolarity(event.target.value as MunicipalityUpdatePolarity)}
          required
          className="min-h-11 w-full"
        >
          {(['boa', 'neutra', 'ruim'] as const).map((option) => (
            <NativeSelectOption key={option} value={option}>
              {municipalityUpdatePolarityLabels[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>Selecione a polaridade do fato observado.</FieldDescription>
        {fieldError(fieldErrors, 'polarity') ? (
          <FieldError>{fieldError(fieldErrors, 'polarity')}</FieldError>
        ) : null}
      </Field>
      <div className="flex items-center gap-3">
        <input type="hidden" name="urgent" value="false" />
        <Checkbox id={urgentId} name="urgent" value="true" className="mt-0.5" />
        <FieldLabel htmlFor={urgentId} className="font-normal">
          Urgente
        </FieldLabel>
      </div>
      {isStaff ? (
        <div className="flex items-start gap-3">
          <input type="hidden" name="adversarySignal" value="false" />
          <Checkbox id={adversaryId} name="adversarySignal" value="true" className="mt-0.5" />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={adversaryId} className="font-normal">
              Sinalizar adversário
            </FieldLabel>
            <FieldDescription>
              Marque se este é um fato relacionado a um adversário.
            </FieldDescription>
          </div>
        </div>
      ) : null}
    </div>
  )
}
