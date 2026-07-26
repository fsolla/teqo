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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import {
  activityKindLabels,
  activityOriginLabels,
  activityStatusLabels,
} from '@/lib/schemas/activity'
import type { ActivityLeadershipOption } from '@/utilities/activityLeadershipOptions'
import type { ActivityFormViewModel } from '@/utilities/activityViewModels'
import { fieldError } from '@/utilities/campaignFormFields'
import { formatIsoAsBahiaDateTimeInput } from '@/utilities/campaignTime'
import type { EligibleAdvisorOption } from '@/utilities/municipalityViewModels'

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
}

const editableStatuses = ['rascunho', 'planejado'] as const

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
}: ActivityFormFieldsProps) => {
  const errorFor = (name: string) => fieldError(fieldErrors, name)
  const statusIsEditable =
    !activity || editableStatuses.includes(activity.status as (typeof editableStatuses)[number])
  const [status, setStatus] = useState<(typeof editableStatuses)[number]>(
    activity && editableStatuses.includes(activity.status as (typeof editableStatuses)[number])
      ? (activity.status as (typeof editableStatuses)[number])
      : 'rascunho',
  )
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
      {statusIsEditable ? (
        <input type="hidden" name="status" value={status} />
      ) : (
        <input type="hidden" name="status" value={activity?.status ?? 'rascunho'} />
      )}

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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errorFor('kind'))}>
                <FieldLabel htmlFor="kind">Tipo de atividade *</FieldLabel>
                <NativeSelect
                  id="kind"
                  name="kind"
                  defaultValue={activity?.kind}
                  required
                  aria-invalid={Boolean(errorFor('kind'))}
                  aria-describedby={errorFor('kind') ? 'kind-error' : undefined}
                  className="w-full **:data-[slot=native-select]:min-h-11"
                >
                  <NativeSelectOption value="">Selecione um tipo</NativeSelectOption>
                  {Object.entries(activityKindLabels).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errorFor('kind') ? (
                  <FieldError id="kind-error">{errorFor('kind')}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLegend>Status *</FieldLegend>
                {statusIsEditable ? (
                  <>
                    <ToggleGroup
                      type="single"
                      value={status}
                      onValueChange={(value) => value && setStatus(value as typeof status)}
                      variant="outline"
                      className="flex w-full flex-wrap justify-start"
                      aria-label="Status da atividade"
                    >
                      <ToggleGroupItem value="planejado">Planejado</ToggleGroupItem>
                      <ToggleGroupItem value="rascunho">Rascunho</ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>
                      Rascunhos não exigem data. Atividades planejadas exigem data e horário de
                      início.
                    </FieldDescription>
                  </>
                ) : (
                  <FieldDescription>
                    Status atual: {activity ? activityStatusLabels[activity.status] : ''}. Use as
                    ações do detalhe para marcar como realizado ou cancelado.
                  </FieldDescription>
                )}
              </Field>
            </div>
            <Field data-invalid={Boolean(errorFor('origin'))}>
              <FieldLabel htmlFor="origin">Origem da atividade</FieldLabel>
              <NativeSelect
                id="origin"
                name="origin"
                defaultValue={activity?.origin ?? 'dado'}
                className="w-full **:data-[slot=native-select]:min-h-11 sm:max-w-sm"
                aria-invalid={Boolean(errorFor('origin'))}
              >
                {Object.entries(activityOriginLabels).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                Registra se a atividade nasceu da análise de dados, de um pedido de articulação ou
                de um compromisso político.
              </FieldDescription>
              {errorFor('origin') ? <FieldError>{errorFor('origin')}</FieldError> : null}
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={Boolean(errorFor('startAt'))}>
              <FieldLabel htmlFor="startAt">Início {status !== 'rascunho' ? '*' : null}</FieldLabel>
              <Input
                id="startAt"
                name="startAt"
                type="datetime-local"
                defaultValue={
                  activity?.startAt ? formatIsoAsBahiaDateTimeInput(activity.startAt) : ''
                }
                required={status !== 'rascunho'}
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
            <Field data-invalid={Boolean(errorFor('deadline'))}>
              <FieldLabel htmlFor="deadline">Prazo de conclusão</FieldLabel>
              <Input
                id="deadline"
                name="deadline"
                type="datetime-local"
                defaultValue={
                  activity?.deadline ? formatIsoAsBahiaDateTimeInput(activity.deadline) : ''
                }
                className="min-h-11"
                aria-invalid={Boolean(errorFor('deadline'))}
                aria-describedby={errorFor('deadline') ? 'deadline-error' : undefined}
              />
              {errorFor('deadline') ? (
                <FieldError id="deadline-error">{errorFor('deadline')}</FieldError>
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
  canManageAdvisors = false,
  activity,
  submitLabel,
  searchContacts,
  searchLeaderships,
}: ActivityFormFieldsProps & {
  action: ActivityFormAction
  submitLabel: string
}) => {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      {activity ? <input type="hidden" name="id" value={activity.id} /> : null}
      {state.message ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.existingHref ? (
        <Button asChild variant="outline" className="min-h-11 w-fit">
          <Link href={state.existingHref}>Abrir atividade existente</Link>
        </Button>
      ) : null}
      <ActivityFormFields
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        advisorOptions={advisorOptions}
        canManageAdvisors={canManageAdvisors}
        activity={activity}
        fieldErrors={state.fieldErrors}
        submittedTitle={state.submittedTitle}
        searchContacts={searchContacts}
        searchLeaderships={searchLeaderships}
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={activity ? `/campanha/atividades/${activity.slug}` : '/campanha/atividades'}>
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
