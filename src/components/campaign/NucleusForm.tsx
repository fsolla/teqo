'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { NucleusTerritoryAndZonesFields } from '@/components/campaign/NucleusTerritoryAndZonesFields'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/utilities/campaignFormFields'
import type { NucleusCoordinatorOption } from '@/utilities/nucleusCoordinatorOptions'
import {
  nucleusPriorityLabels,
  organizationKindLabels,
  sectorKindLabels,
} from '@/utilities/nucleusUi'
import type { NucleusFormViewModel } from '@/utilities/nucleusViewModels'

export type NucleusFormState = {
  message?: string
  fieldErrors?: Record<string, string[]>
  existingHref?: string
  submittedName?: string
}

type NucleusFormAction = (state: NucleusFormState, formData: FormData) => Promise<NucleusFormState>

export type NucleusFormFieldsProps = {
  coordinators?: NucleusCoordinatorOption[]
  nucleus?: NucleusFormViewModel
  fieldErrors?: Record<string, string[]>
  submittedName?: string
}

const SelectField = ({
  id,
  label,
  name,
  defaultValue,
  children,
  error,
  required,
}: {
  id: string
  label: string
  name: string
  defaultValue?: string
  children: React.ReactNode
  error?: string
  required?: boolean
}) => (
  <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <NativeSelect
      id={id}
      name={name}
      defaultValue={defaultValue}
      required={required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      className="w-full **:data-[slot=native-select]:min-h-11"
    >
      {children}
    </NativeSelect>
    {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
  </Field>
)

export const NucleusFormFields = ({
  coordinators = [],
  nucleus,
  fieldErrors = {},
  submittedName,
}: NucleusFormFieldsProps) => {
  const errorFor = (name: string) => fieldError(fieldErrors, name)

  return (
    <FieldGroup>
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errorFor('name'))}>
              <FieldLabel htmlFor="name">Nome do núcleo *</FieldLabel>
              <Input
                id="name"
                name="name"
                defaultValue={submittedName ?? nucleus?.name}
                minLength={2}
                maxLength={160}
                className="min-h-11"
                required
                readOnly={Boolean(nucleus)}
                aria-invalid={Boolean(errorFor('name'))}
                aria-describedby={errorFor('name') ? 'name-error' : undefined}
              />
              {errorFor('name') ? (
                <FieldError id="name-error">{errorFor('name')}</FieldError>
              ) : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="organizationKind"
                label="Natureza organizativa *"
                name="organizationKind"
                defaultValue={nucleus?.organizationKind ?? 'territorial'}
                error={errorFor('organizationKind')}
                required
              >
                {Object.entries(organizationKindLabels).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </SelectField>
              <Field data-invalid={Boolean(errorFor('organizationLabel'))}>
                <FieldLabel htmlFor="organizationLabel">Nome da organização</FieldLabel>
                <Input
                  id="organizationLabel"
                  name="organizationLabel"
                  defaultValue={nucleus?.organizationLabel ?? ''}
                  maxLength={160}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor('organizationLabel'))}
                  aria-describedby={
                    errorFor('organizationLabel') ? 'organizationLabel-error' : undefined
                  }
                />
                {errorFor('organizationLabel') ? (
                  <FieldError id="organizationLabel-error">
                    {errorFor('organizationLabel')}
                  </FieldError>
                ) : null}
              </Field>
              <SelectField
                id="sectorKind"
                label="Setor"
                name="sectorKind"
                defaultValue={nucleus?.sectorKind ?? ''}
                error={errorFor('sectorKind')}
              >
                <NativeSelectOption value="">Não informado</NativeSelectOption>
                {Object.entries(sectorKindLabels).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </SelectField>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Território *</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <NucleusTerritoryAndZonesFields values={nucleus} fieldErrors={fieldErrors} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errorFor('locality'))}>
                <FieldLabel htmlFor="locality">Localidade</FieldLabel>
                <Input
                  id="locality"
                  name="locality"
                  defaultValue={nucleus?.locality ?? ''}
                  maxLength={160}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor('locality'))}
                  aria-describedby={errorFor('locality') ? 'locality-error' : undefined}
                />
                {errorFor('locality') ? (
                  <FieldError id="locality-error">{errorFor('locality')}</FieldError>
                ) : null}
              </Field>
            </div>
            <FieldDescription>
              Obrigatório: informe ao menos território de identidade, município ou localidade. Bahia
              é implícita.
            </FieldDescription>
            <Field data-invalid={Boolean(errorFor('territoryNotes'))}>
              <FieldLabel htmlFor="territoryNotes">Observações do território</FieldLabel>
              <Textarea
                id="territoryNotes"
                name="territoryNotes"
                defaultValue={nucleus?.territoryNotes ?? ''}
                maxLength={2000}
                className="min-h-24"
                aria-invalid={Boolean(errorFor('territoryNotes'))}
                aria-describedby={errorFor('territoryNotes') ? 'territoryNotes-error' : undefined}
              />
              {errorFor('territoryNotes') ? (
                <FieldError id="territoryNotes-error">{errorFor('territoryNotes')}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metas 2026</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={Boolean(errorFor('voteGoals.good'))}>
                <FieldLabel htmlFor="voteGoalsGood">Bom</FieldLabel>
                <Input
                  id="voteGoalsGood"
                  name="voteGoalsGood"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={nucleus?.voteGoals?.good ?? ''}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor('voteGoals.good'))}
                />
              </Field>
              <Field data-invalid={Boolean(errorFor('voteGoals.regular'))}>
                <FieldLabel htmlFor="voteGoalsRegular">Regular</FieldLabel>
                <Input
                  id="voteGoalsRegular"
                  name="voteGoalsRegular"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={nucleus?.voteGoals?.regular ?? ''}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor('voteGoals.regular'))}
                />
              </Field>
              <Field data-invalid={Boolean(errorFor('voteGoals.minimum'))}>
                <FieldLabel htmlFor="voteGoalsMinimum">Mínimo</FieldLabel>
                <Input
                  id="voteGoalsMinimum"
                  name="voteGoalsMinimum"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={nucleus?.voteGoals?.minimum ?? ''}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor('voteGoals.minimum'))}
                />
              </Field>
            </div>
            {['voteGoals.good', 'voteGoals.regular', 'voteGoals.minimum'].map((field) =>
              errorFor(field) ? (
                <FieldError key={field} id={`${field}-error`}>
                  {errorFor(field)}
                </FieldError>
              ) : null,
            )}
            <FieldDescription>
              Quando informadas, as metas devem seguir a ordem Bom ≥ Regular ≥ Mínimo.
            </FieldDescription>
            <SelectField
              id="priority"
              label="Prioridade"
              name="priority"
              defaultValue={nucleus?.priority ?? 'normal'}
              error={errorFor('priority')}
            >
              {Object.entries(nucleusPriorityLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </SelectField>
          </FieldGroup>
        </CardContent>
      </Card>

      {!nucleus ? (
        <Card>
          <CardHeader>
            <CardTitle>Coordenação</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldSet
              aria-invalid={Boolean(errorFor('coordinators'))}
              aria-describedby={errorFor('coordinators') ? 'coordinators-error' : undefined}
            >
              <FieldLegend>Coordenadores responsáveis</FieldLegend>
              <FieldDescription>
                Núcleos sem coordenador ficam marcados como cobertura incompleta.
              </FieldDescription>
              {coordinators.length ? (
                <div data-slot="checkbox-group" className="grid gap-2 sm:grid-cols-2">
                  {coordinators.map((coordinator) => (
                    <FieldLabel key={coordinator.id}>
                      <Field orientation="horizontal" className="min-h-11 rounded-lg border p-3">
                        <Checkbox name="coordinators" value={String(coordinator.id)} />
                        <span>
                          {coordinator.name}
                          {coordinator.isCurrent ? ' (você)' : ''}
                        </span>
                      </Field>
                    </FieldLabel>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum coordenador disponível. O núcleo será criado sem cobertura.
                </p>
              )}
              {errorFor('coordinators') ? (
                <FieldError id="coordinators-error">{errorFor('coordinators')}</FieldError>
              ) : null}
            </FieldSet>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Dobrada opcional</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errorFor('ticketAlliance'))}>
                <FieldLabel htmlFor="partnerName">Nome da parceria</FieldLabel>
                <Input
                  id="partnerName"
                  name="partnerName"
                  defaultValue={nucleus?.ticketAlliance?.partnerName ?? ''}
                  maxLength={120}
                  className="min-h-11"
                  aria-invalid={Boolean(errorFor('ticketAlliance'))}
                  aria-describedby={errorFor('ticketAlliance') ? 'ticketAlliance-error' : undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="partnerOffice">Cargo</FieldLabel>
                <Input
                  id="partnerOffice"
                  name="partnerOffice"
                  defaultValue={nucleus?.ticketAlliance?.office ?? ''}
                  maxLength={120}
                  className="min-h-11"
                />
              </Field>
            </div>
            <FieldLabel>
              <Field orientation="horizontal" className="min-h-11">
                <Checkbox
                  id="isCampaignPartner"
                  name="isCampaignPartner"
                  defaultChecked={Boolean(nucleus?.ticketAlliance?.isCampaignPartner)}
                />
                <span>Parceiro da campanha</span>
              </Field>
            </FieldLabel>
            {errorFor('ticketAlliance') ? (
              <FieldError id="ticketAlliance-error">{errorFor('ticketAlliance')}</FieldError>
            ) : null}
            <Field>
              <FieldLabel htmlFor="partnerNotes">Observações da dobrada</FieldLabel>
              <Textarea
                id="partnerNotes"
                name="partnerNotes"
                defaultValue={nucleus?.ticketAlliance?.notes ?? ''}
                maxLength={1000}
                className="min-h-24"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </FieldGroup>
  )
}

export const NucleusForm = ({
  action,
  coordinators,
  nucleus,
  submitLabel,
}: NucleusFormFieldsProps & {
  action: NucleusFormAction
  submitLabel: string
}) => {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      {nucleus ? <input type="hidden" name="id" value={nucleus.id} /> : null}
      {state.message ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.existingHref ? (
        <Button asChild variant="outline" className="min-h-11 w-fit">
          <Link href={state.existingHref}>Abrir núcleo existente</Link>
        </Button>
      ) : null}
      <NucleusFormFields
        coordinators={coordinators}
        nucleus={nucleus}
        fieldErrors={state.fieldErrors}
        submittedName={state.submittedName}
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={nucleus ? `/campanha/nucleos/${nucleus.slug}` : '/campanha/nucleos'}>
            Cancelar
          </Link>
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? 'Salvando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
