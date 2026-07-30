'use client'

import { useState } from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  municipalitySignalTypeDescriptions,
  municipalitySignalTypeLabels,
  municipalitySignalTypes,
  type MunicipalitySignalType,
} from '@/lib/schemas/municipalityUpdate'
import { fieldError } from '@/utilities/campaignFormFields'

type MunicipalitySignalFieldsProps = {
  /** Unique prefix so table + card controls for the same row don't collide on ids. */
  idPrefix: string
  fieldErrors?: Record<string, string[]>
}

export const MunicipalitySignalFields = ({
  idPrefix,
  fieldErrors,
}: MunicipalitySignalFieldsProps) => {
  const [signalType, setSignalType] = useState<MunicipalitySignalType | ''>('')
  const bodyId = `${idPrefix}-body`
  const signalTypeId = `${idPrefix}-signal-type`

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={bodyId}>Texto</FieldLabel>
        <Textarea id={bodyId} name="body" rows={2} maxLength={5000} className="min-h-11" />
        {fieldError(fieldErrors, 'body') ? (
          <FieldError>{fieldError(fieldErrors, 'body')}</FieldError>
        ) : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={signalTypeId}>Tipo do sinal</FieldLabel>
        <NativeSelect
          id={signalTypeId}
          name="signalType"
          value={signalType}
          onChange={(event) => setSignalType(event.target.value as MunicipalitySignalType | '')}
          required
          className="min-h-11 w-full"
        >
          <NativeSelectOption value="">Selecione</NativeSelectOption>
          {municipalitySignalTypes.map((entry) => (
            <NativeSelectOption key={entry} value={entry}>
              {municipalitySignalTypeLabels[entry]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {signalType ? (
          <FieldDescription>{municipalitySignalTypeDescriptions[signalType]}</FieldDescription>
        ) : null}
        {fieldError(fieldErrors, 'signalType') ? (
          <FieldError>{fieldError(fieldErrors, 'signalType')}</FieldError>
        ) : null}
      </Field>
    </div>
  )
}
