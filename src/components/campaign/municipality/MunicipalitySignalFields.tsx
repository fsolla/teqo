'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const signalSourceId = `${idPrefix}-signal-source`
  const triangulatedId = `${idPrefix}-triangulated`

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
      <Field>
        <FieldLabel htmlFor={signalSourceId}>Fonte</FieldLabel>
        <Input
          id={signalSourceId}
          name="signalSource"
          maxLength={160}
          required
          className="min-h-11"
        />
        {fieldError(fieldErrors, 'signalSource') ? (
          <FieldError>{fieldError(fieldErrors, 'signalSource')}</FieldError>
        ) : null}
      </Field>
      <Label htmlFor={triangulatedId} className="flex min-h-11 items-center gap-3 font-normal">
        <Checkbox id={triangulatedId} name="triangulated" value="on" />
        <span>Triangulado — confirmado por mais de uma fonte independente</span>
      </Label>
    </div>
  )
}
