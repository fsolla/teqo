'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { ActivityDemandFields } from '@/components/campaign/activity/ActivityDemandFields'
import { ActivityTaskFields } from '@/components/campaign/activity/ActivityTaskFields'
import { AsyncSearchCombobox } from '@/components/campaign/shared/AsyncSearchCombobox'
import {
  ContactCombobox,
  type ContactComboboxOption,
} from '@/components/campaign/shared/ContactCombobox'
import {
  RelationMultiSelect,
  type RelationOption,
} from '@/components/campaign/shared/RelationMultiSelect'
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
import { formatIsoAsBahiaDateTimeInput } from '@/lib/campaignTime'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import { MAX_ACTIVITY_TAG_LENGTH, MAX_ACTIVITY_TAGS } from '@/lib/schemas/activity'
import type { ActivityLeadershipOption } from '@/utilities/activityLeadershipOptions'
import type { ActivityFormViewModel } from '@/utilities/activityViewModels'
import { fieldError } from '@/utilities/campaignFormFields'
import type { EligibleAdvisorOption } from '@/utilities/municipality/municipalityViewModels'

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
  advisorOptions?: EligibleAdvisorOption[]
  canManageAdvisors?: boolean
  activity?: ActivityFormViewModel
  fieldErrors?: Record<string, string[]>
  submittedTitle?: string
  searchContacts: (query: string) => Promise<ContactComboboxOption[]>
  searchLeaderships: (query: string) => Promise<ActivityLeadershipOption[]>
  /** Tags already used across activities, for autocomplete. */
  knownTags?: string[]
}

const TagInput = ({
  initialTags = [],
  knownTags = [],
  error,
}: {
  initialTags?: string[]
  knownTags?: string[]
  error?: string
}) => {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')

  const datalistId = 'activity-tags-datalist'

  const addTag = (raw: string) => {
    const trimmed = raw.trim().slice(0, MAX_ACTIVITY_TAG_LENGTH)
    if (!trimmed) return
    if (tags.includes(trimmed)) return
    if (tags.length >= MAX_ACTIVITY_TAGS) return
    setTags((current) => [...current, trimmed])
    setInput('')
  }

  const removeTag = (tag: string) => {
    setTags((current) => current.filter((entry) => entry !== tag))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-sm opacity-70 hover:opacity-100"
              aria-label={`Remover tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {tags.length < MAX_ACTIVITY_TAGS ? (
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTag(input)
              } else if (event.key === 'Backspace' && !input && tags.length > 0) {
                setTags((current) => current.slice(0, -1))
              }
            }}
            onBlur={() => addTag(input)}
            placeholder={tags.length === 0 ? 'Ex.: comício, imprensa…' : 'Adicionar tag…'}
            className="min-h-9 flex-1"
            list={datalistId}
            maxLength={MAX_ACTIVITY_TAG_LENGTH}
          />
        ) : null}
        <datalist id={datalistId}>
          {knownTags
            .filter((tag) => !tags.includes(tag))
            .map((tag) => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      </div>
      <input type="hidden" name="tagsJson" value={JSON.stringify(tags)} />
      <FieldDescription>
        Classificação livre do compromisso. Digite e pressione Enter ou vírgula para adicionar.
      </FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}

const ActivityFormFields = ({
  municipalityOptions,
  organizationOptions,
  advisorOptions = [],
  canManageAdvisors = false,
  activity,
  fieldErrors = {},
  submittedTitle,
  searchContacts,
  searchLeaderships,
  knownTags = [],
}: ActivityFormFieldsProps) => {
  const errorFor = (name: string) => fieldError(fieldErrors, name)
  const [responsible, setResponsible] = useState<ContactComboboxOption | null>(
    activity?.responsible
      ? {
          id: activity.responsible.id,
          name: activity.responsible.name,
          phone: activity.responsible.phone,
        }
      : null,
  )
  const [leadership, setLeadership] = useState<ActivityLeadershipOption | null>(
    activity?.leadership ? { id: activity.leadership.id, label: activity.leadership.label } : null,
  )

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
                defaultValue={submittedTitle ?? activity?.title}
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
              <TagInput
                initialTags={activity?.tags ?? []}
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
                defaultValue={
                  activity?.startAt ? formatIsoAsBahiaDateTimeInput(activity.startAt) : ''
                }
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
                defaultValue={activity?.endAt ? formatIsoAsBahiaDateTimeInput(activity.endAt) : ''}
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
                defaultValue={activity?.municipalityId ? String(activity.municipalityId) : ''}
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
            <Field data-invalid={Boolean(errorFor('responsible'))}>
              <FieldLabel>Responsável</FieldLabel>
              <ContactCombobox
                name="responsible"
                label="Responsável pela atividade"
                current={responsible}
                search={searchContacts}
                onChange={setResponsible}
              />
              {errorFor('responsible') ? (
                <FieldError id="responsible-error">{errorFor('responsible')}</FieldError>
              ) : null}
            </Field>

            <Field data-invalid={Boolean(errorFor('leadership'))}>
              <FieldLabel>Liderança vinculada</FieldLabel>
              <AsyncSearchCombobox
                name="leadership"
                label="Liderança vinculada"
                value={leadership}
                emptyOptionLabel="Nenhuma"
                dialogDescription="Busque lideranças engajadas por nome ou celular."
                isQueryReady={isContactSearchQueryReady}
                queryTooShortMessage="Digite ao menos dois caracteres para buscar."
                search={searchLeaderships}
                onChange={setLeadership}
              />
              <FieldDescription>
                Quando vinculada, a liderança engajada vê a atividade e pode marcar tarefas e
                registrar atualizações.
              </FieldDescription>
              {errorFor('leadership') ? (
                <FieldError id="leadership-error">{errorFor('leadership')}</FieldError>
              ) : null}
            </Field>

            <RelationMultiSelect
              name="organizations"
              label="Organizações apoiadoras"
              options={organizationOptions}
              initialSelectedIDs={activity?.organizationIDs ?? []}
              error={errorFor('organizations')}
              placeholder="Adicionar organização…"
            />

            {canManageAdvisors ? (
              <FieldSet
                aria-invalid={Boolean(errorFor('advisors'))}
                aria-describedby={errorFor('advisors') ? 'advisors-error' : undefined}
              >
                <FieldLegend>Assessores responsáveis</FieldLegend>
                <FieldDescription>
                  Assessores selecionados podem editar esta atividade e gerenciar suas tarefas.
                </FieldDescription>
                <input type="hidden" name="advisorsSubmitted" value="1" />
                {advisorOptions.length ? (
                  <div data-slot="checkbox-group" className="grid gap-2 sm:grid-cols-2">
                    {advisorOptions.map((advisor) => (
                      <FieldLabel key={advisor.id}>
                        <Field orientation="horizontal" className="min-h-11 rounded-lg border p-3">
                          <Checkbox
                            name="advisors"
                            value={String(advisor.id)}
                            defaultChecked={
                              activity
                                ? activity.advisorIDs.includes(advisor.id)
                                : advisor.isCurrent
                            }
                          />
                          <span>
                            {advisor.name}
                            {advisor.isCurrent ? ' (você)' : ''}
                          </span>
                        </Field>
                      </FieldLabel>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum assessor disponível.</p>
                )}
                {errorFor('advisors') ? (
                  <FieldError id="advisors-error">{errorFor('advisors')}</FieldError>
                ) : null}
              </FieldSet>
            ) : null}
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
  advisorOptions,
  canManageAdvisors,
  activity,
  fieldErrors: externalFieldErrors,
  submittedTitle,
  searchContacts,
  searchLeaderships,
  knownTags,
  submitLabel,
}: ActivityFormFieldsProps & {
  action: ActivityFormAction
  submitLabel?: string
}) => {
  const [state, submitAction, isPending] = useActionState(action, {})

  return (
    <form action={submitAction} className="flex flex-col gap-5">
      <ActivityFormFields
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        advisorOptions={advisorOptions}
        canManageAdvisors={canManageAdvisors}
        activity={activity}
        fieldErrors={state.fieldErrors ?? externalFieldErrors}
        submittedTitle={state.submittedTitle ?? submittedTitle}
        searchContacts={searchContacts}
        searchLeaderships={searchLeaderships}
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
          <Link href={activity ? `/campanha/atividades/${activity.slug}` : '/campanha/atividades'}>
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
