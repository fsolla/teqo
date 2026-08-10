'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { ActivityDemandFields } from '@/components/campaign/activity/ActivityDemandFields'
import { ActivityTagInput } from '@/components/campaign/activity/ActivityTagInput'
import { ActivityTaskFields } from '@/components/campaign/activity/ActivityTaskFields'
import type { ContactComboboxOption } from '@/components/campaign/shared/ContactCombobox'
import {
  RelationMultiSelect,
  type RelationOption,
} from '@/components/campaign/shared/RelationMultiSelect'
import {
  ResponsibleMultiSelect,
  type ResponsibleOption,
} from '@/components/campaign/shared/ResponsibleMultiSelect'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { formatIsoAsBahiaDateTimeInput } from '@/lib/campaignTime'
import type { ActivityCreatePrefill } from '@/utilities/activityUi'
import type { ActivityFormViewModel } from '@/utilities/activityViewModels'
import { fieldError } from '@/utilities/campaignFormFields'

export type ActivityFormState = {
  message?: string
  fieldErrors?: Record<string, string[]>
  existingHref?: string
  submittedTitle?: string
}

type ActivityFormAction = (
  state: ActivityFormState,
  formData: FormData,
) => Promise<ActivityFormState>

export type ActivityFormFieldsProps = {
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  activity?: ActivityFormViewModel
  initialValues?: ActivityCreatePrefill
  fieldErrors?: Record<string, string[]>
  submittedTitle?: string
  searchContacts: (query: string) => Promise<ContactComboboxOption[]>
  searchResponsibles: (query: string) => Promise<ResponsibleOption[]>
  /** Tags already used across activities, for autocomplete. */
  knownTags?: string[]
}

const ActivityFormFields = ({
  municipalityOptions,
  organizationOptions,
  activity,
  initialValues,
  fieldErrors = {},
  submittedTitle,
  searchContacts,
  searchResponsibles,
  knownTags = [],
}: ActivityFormFieldsProps) => {
  const errorFor = (name: string) => fieldError(fieldErrors, name)
  const initialResponsibles = activity?.responsibles ?? []
  const initialStartAt = activity?.startAt ?? initialValues?.startAt
  const initialEndAt = activity?.endAt ?? initialValues?.endAt
  const initialMunicipalityId = activity?.municipalityId ?? initialValues?.municipalityId

  return (
    <FieldGroup>
      <input type="hidden" name="status" value="confirmado" />

      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errorFor('title'))}>
              <FieldLabel htmlFor="title">Título *</FieldLabel>
              <Input
                id="title"
                name="title"
                defaultValue={submittedTitle ?? initialValues?.title ?? activity?.title}
                minLength={2}
                maxLength={160}
                className="min-h-11"
                required
                readOnly={Boolean(activity)}
                aria-invalid={Boolean(errorFor('title'))}
                aria-describedby={errorFor('title') ? 'title-error' : undefined}
              />
              {errorFor('title') ? (
                <FieldError id="title-error">{errorFor('title')}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={Boolean(errorFor('tagsJson'))}>
              <FieldLabel>Tags</FieldLabel>
              <ActivityTagInput
                initialTags={initialValues?.tags ?? activity?.tags ?? []}
                knownTags={knownTags}
                error={errorFor('tagsJson')}
              />
            </Field>

            <Field data-invalid={Boolean(errorFor('description'))}>
              <FieldLabel htmlFor="description">Descrição</FieldLabel>
              <Textarea
                id="description"
                name="description"
                defaultValue={activity?.description ?? ''}
                maxLength={4000}
                className="min-h-24"
                aria-invalid={Boolean(errorFor('description'))}
                aria-describedby={errorFor('description') ? 'description-error' : undefined}
              />
              {errorFor('description') ? (
                <FieldError id="description-error">{errorFor('description')}</FieldError>
              ) : null}
            </Field>
            <FieldLabel>
              <Field orientation="horizontal" className="min-h-11 rounded-lg border p-3">
                <Checkbox name="deputyPresent" defaultChecked={activity?.deputyPresent ?? false} />
                <span>Deputado presente</span>
              </Field>
            </FieldLabel>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data e horário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errorFor('startAt'))}>
              <FieldLabel htmlFor="startAt">Início *</FieldLabel>
              <Input
                id="startAt"
                name="startAt"
                type="datetime-local"
                defaultValue={initialStartAt ? formatIsoAsBahiaDateTimeInput(initialStartAt) : ''}
                required
                className="min-h-11"
                aria-invalid={Boolean(errorFor('startAt'))}
                aria-describedby={errorFor('startAt') ? 'startAt-error' : undefined}
              />
              {errorFor('startAt') ? (
                <FieldError id="startAt-error">{errorFor('startAt')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(errorFor('endAt'))}>
              <FieldLabel htmlFor="endAt">Término</FieldLabel>
              <Input
                id="endAt"
                name="endAt"
                type="datetime-local"
                defaultValue={initialEndAt ? formatIsoAsBahiaDateTimeInput(initialEndAt) : ''}
                className="min-h-11"
                aria-invalid={Boolean(errorFor('endAt'))}
                aria-describedby={errorFor('endAt') ? 'endAt-error' : undefined}
              />
              {errorFor('endAt') ? (
                <FieldError id="endAt-error">{errorFor('endAt')}</FieldError>
              ) : null}
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onde</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errorFor('municipality'))}>
              <FieldLabel htmlFor="municipality">Município *</FieldLabel>
              <NativeSelect
                id="municipality"
                name="municipality"
                defaultValue={initialMunicipalityId ? String(initialMunicipalityId) : ''}
                required
                aria-invalid={Boolean(errorFor('municipality'))}
                aria-describedby={errorFor('municipality') ? 'municipality-error' : undefined}
                className="w-full **:data-[slot=native-select]:min-h-11"
              >
                <NativeSelectOption value="">Selecione o município</NativeSelectOption>
                {municipalityOptions.map((option) => (
                  <NativeSelectOption key={option.id} value={String(option.id)}>
                    {option.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errorFor('municipality') ? (
                <FieldError id="municipality-error">{errorFor('municipality')}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(errorFor('locality'))}>
              <FieldLabel htmlFor="locality">Local (bairro, endereço ou referência)</FieldLabel>
              <Input
                id="locality"
                name="locality"
                defaultValue={activity?.locality ?? ''}
                maxLength={160}
                className="min-h-11"
                aria-invalid={Boolean(errorFor('locality'))}
                aria-describedby={errorFor('locality') ? 'locality-error' : undefined}
              />
              {errorFor('locality') ? (
                <FieldError id="locality-error">{errorFor('locality')}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pessoas e organizações</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <ResponsibleMultiSelect
              name="responsiblesJson"
              label="Responsáveis"
              value={initialResponsibles}
              error={errorFor('responsiblesJson')}
              description="Quem conduz este compromisso: equipe da campanha, liderança ou dobradinha — um ou vários."
              search={searchResponsibles}
            />

            <RelationMultiSelect
              name="organizations"
              label="Organizações apoiadoras"
              options={organizationOptions}
              initialSelectedIDs={activity?.organizationIDs ?? []}
              error={errorFor('organizations')}
              placeholder="Adicionar organização…"
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTaskFields
            initialTasks={activity?.tasks ?? []}
            searchContacts={searchContacts}
            error={errorFor('tasksJson')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demandas</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityDemandFields error={errorFor('demandsJson')} />
        </CardContent>
      </Card>
    </FieldGroup>
  )
}

export const ActivityForm = ({
  action,
  municipalityOptions,
  organizationOptions,
  activity,
  initialValues,
  fieldErrors: externalFieldErrors,
  submittedTitle,
  searchContacts,
  searchResponsibles,
  knownTags,
  submitLabel,
  cancelHref,
}: ActivityFormFieldsProps & {
  action: ActivityFormAction
  submitLabel?: string
  cancelHref?: string
}) => {
  const [state, submitAction, isPending] = useActionState(action, {})

  return (
    <form action={submitAction} className="flex flex-col gap-5">
      <ActivityFormFields
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        activity={activity}
        initialValues={initialValues}
        fieldErrors={state.fieldErrors ?? externalFieldErrors}
        submittedTitle={state.submittedTitle ?? submittedTitle}
        searchContacts={searchContacts}
        searchResponsibles={searchResponsibles}
        knownTags={knownTags}
      />

      {state.existingHref ? (
        <Alert variant="destructive">
          <AlertTitle>Já existe uma atividade com este título</AlertTitle>
          <AlertDescription>
            <a
              href={state.existingHref}
              className="font-medium text-primary underline underline-offset-4"
            >
              Ver atividade existente
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert variant="destructive">
          <AlertTitle>Nada foi gravado</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" className="min-h-11">
          <Link
            href={
              activity
                ? `/campanha/atividades/${activity.slug}`
                : (cancelHref ?? '/campanha/agenda')
            }
          >
            Cancelar
          </Link>
        </Button>
        <Button type="submit" disabled={isPending} className="min-h-11">
          {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          {submitLabel ?? (activity ? 'Salvar alterações' : 'Criar compromisso')}
        </Button>
      </div>
    </form>
  )
}
