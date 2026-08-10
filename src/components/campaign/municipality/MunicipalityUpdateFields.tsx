'use client'

import { useState } from 'react'

import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import {
  municipalityUpdatePolarityLabels,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import { fieldError } from '@/utilities/campaignFormFields'

type MunicipalityUpdateFieldsProps = {
  idPrefix: string
  fieldErrors?: Record<string, string[]>
  isStaff: boolean
  /**
   * 'labeled' (desktop): visible labels, descriptions and bordered fields.
   * 'list' (mobile): visually hidden labels, no borders, full-bleed divider
   * rows and right-aligned check boxes (C107 — the field is the same, only
   * the presentation varies).
   */
  layout?: 'labeled' | 'list'
}

const POLARITY_OPTIONS = ['ruim', 'neutra', 'boa'] as const

/**
 * One Urgente/Sinalizar adversário row. In the list layout the row is a
 * `<label>` around the Radix Checkbox (a `<button>` — labelable), so the whole
 * line is a tap target and the square sits on the right; the hidden "false"
 * input lives OUTSIDE the label so label activation never re-checks it.
 */
const CheckRow = ({
  id,
  name,
  label,
  description,
  isList,
}: {
  id: string
  name: string
  label: string
  description?: string
  isList: boolean
}) => {
  if (isList) {
    return (
      <div className="px-4">
        <input type="hidden" name={name} value="false" />
        <label
          htmlFor={id}
          className="flex min-h-11 cursor-pointer items-center justify-between gap-3"
        >
          <span>{label}</span>
          <Checkbox id={id} name={name} value="true" />
        </label>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <input type="hidden" name={name} value="false" />
      <Checkbox id={id} name={name} value="true" className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={id} className="font-normal">
          {label}
        </FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </div>
    </div>
  )
}

export const MunicipalityUpdateFields = ({
  idPrefix,
  fieldErrors,
  isStaff,
  layout = 'labeled',
}: MunicipalityUpdateFieldsProps) => {
  const [polarity, setPolarity] = useState<MunicipalityUpdatePolarity>('neutra')
  const bodyId = `${idPrefix}-body`
  const polarityId = `${idPrefix}-polarity`
  const polarityLabelId = `${idPrefix}-polarity-label`
  const urgentId = `${idPrefix}-urgent`
  const adversaryId = `${idPrefix}-adversary`
  const isList = layout === 'list'
  const bodyError = fieldError(fieldErrors, 'body')
  const polarityError = fieldError(fieldErrors, 'polarity')

  const polarityControl = (
    <ToggleGroup
      id={polarityId}
      type="single"
      value={polarity}
      // Radix single emits '' when the selected item is clicked again; a
      // required 3-value field cannot be deselected, so '' is a no-op.
      onValueChange={(value) => {
        if (value) setPolarity(value as MunicipalityUpdatePolarity)
      }}
      variant="outline"
      spacing={0}
      aria-labelledby={polarityLabelId}
      className="w-full"
    >
      {POLARITY_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
        >
          {municipalityUpdatePolarityLabels[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )

  if (isList) {
    return (
      <div className="flex flex-col divide-y divide-border">
        <div className="px-4 pt-3 pb-2">
          <FieldLabel htmlFor={bodyId} className="sr-only">
            Texto
          </FieldLabel>
          <Textarea
            id={bodyId}
            name="body"
            rows={2}
            maxLength={5000}
            required
            placeholder="Descrever o que aconteceu..."
            className="min-h-11 rounded-none border-0 bg-transparent px-0 py-1 shadow-none dark:bg-transparent"
          />
          {bodyError ? <FieldError>{bodyError}</FieldError> : null}
        </div>
        <div className="px-4 py-3">
          <FieldLabel id={polarityLabelId} className="sr-only">
            Polaridade
          </FieldLabel>
          <input type="hidden" name="polarity" value={polarity} />
          {polarityControl}
          {polarityError ? <FieldError>{polarityError}</FieldError> : null}
        </div>
        <CheckRow id={urgentId} name="urgent" label="Urgente" isList />
        {isStaff ? (
          <CheckRow id={adversaryId} name="adversarySignal" label="Sinalizar adversário" isList />
        ) : null}
      </div>
    )
  }

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
        {bodyError ? <FieldError>{bodyError}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel id={polarityLabelId}>Polaridade</FieldLabel>
        <input type="hidden" name="polarity" value={polarity} />
        {polarityControl}
        <FieldDescription>Selecione a polaridade do fato observado.</FieldDescription>
        {polarityError ? <FieldError>{polarityError}</FieldError> : null}
      </Field>
      <CheckRow id={urgentId} name="urgent" label="Urgente" isList={false} />
      {isStaff ? (
        <CheckRow
          id={adversaryId}
          name="adversarySignal"
          label="Sinalizar adversário"
          description="Marque se este é um fato relacionado a um adversário."
          isList={false}
        />
      ) : null}
    </div>
  )
}
