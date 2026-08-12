'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  searchActivityContactOptions,
  searchActivityResponsibleOptionsAction,
} from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import {
  createActivityOverlay,
  loadActivityEditDraft,
  updateActivityOverlay,
} from '@/app/(campaign)/campanha/actions/activity'
import { ActivityDateTimeField } from '@/components/campaign/activity/ActivityDateTimeField'
import { ActivityDemandFields } from '@/components/campaign/activity/ActivityDemandFields'
import { ActivityTagInput } from '@/components/campaign/activity/ActivityTagInput'
import { ActivityTaskFields } from '@/components/campaign/activity/ActivityTaskFields'
import {
  RelationMultiSelect,
  type RelationOption,
} from '@/components/campaign/shared/RelationMultiSelect'
import { ResponsibleMultiSelect } from '@/components/campaign/shared/ResponsibleMultiSelect'
import { StrictCombobox } from '@/components/campaign/shared/StrictCombobox'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { allDayRangeValid } from '@/lib/activityAllDay'
import { ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE } from '@/lib/activityOverlayMessages'
import {
  formatBahiaDateTimeLabel,
  formatIsoAsBahiaDateTimeInput,
  parseBahiaDateTimeInput,
} from '@/lib/campaignTime'
import type { ActivityAgendaState } from '@/utilities/activityUi'
import type { ActivityFormViewModel } from '@/utilities/activityViewModels'
import type { StrictComboboxOption } from '@/utilities/territory/territoryComboboxOptions'

/**
 * C123 — the agenda's ONE create/edit surface. A modal Dialog (desktop) or the
 * C103 top drawer (mobile) hosting every section the full form had; creating
 * (slot click) and editing (event click / detail button) live here, and the
 * `/atividades/nova` / `/atividades/[slug]/editar` pages are gone.
 *
 * The submit posts FormData to `createActivityOverlay` / `updateActivityOverlay`
 * (the same server parsers the old full form used), never navigates, and the
 * parent refetches the visible window (`onSaved`). Edit mode loads the form
 * view model through `loadActivityEditDraft` (staff-scoped).
 */

export type ActivityOverlayRequest =
  | { kind: 'create'; startAt: string; endAt: string }
  | { kind: 'edit'; activityId: number }

type ActivityOverlayProps = {
  request: ActivityOverlayRequest | null
  isNarrow: boolean
  /** Create-mode prefill: the agenda's active municipality filter. Edit mode ignores it. */
  agendaState?: ActivityAgendaState
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  knownTags?: string[]
  onClose: () => void
  onSaved: () => void
}

const inlineMunicipalityOptions = (options: RelationOption[]): StrictComboboxOption[] =>
  options.map((option) => ({ value: String(option.id), label: option.name }))

/** List-row styling for the label-less mobile sheet (C103). */
const sheetFieldInputClass =
  'rounded-none border-0 bg-transparent px-0 py-0 focus-visible:ring-2 focus-visible:ring-primary/30'

type OverlayDateTimeFieldProps = {
  sheet: boolean
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  invalid: boolean
  error?: string
  required?: boolean
  /** C104 — false hides the time selects (all-day mode). */
  timeVisible?: boolean
}

const OverlayDateTimeField = ({
  sheet,
  id,
  label,
  value,
  onValueChange,
  invalid,
  error,
  required = false,
  timeVisible = true,
}: OverlayDateTimeFieldProps) => (
  <Field data-invalid={invalid}>
    <FieldLabel htmlFor={id} className={sheet ? 'sr-only' : undefined}>
      {label}
      {required ? ' *' : ''}
    </FieldLabel>
    <ActivityDateTimeField
      id={id}
      value={value}
      onValueChange={onValueChange}
      invalid={invalid}
      errorId={error ? `${id}-error` : undefined}
      isNarrow={sheet}
      label={label}
      required={required}
      timeVisible={timeVisible}
    />
    {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
  </Field>
)

type ActivityOverlayFormProps = {
  variant: 'modal' | 'sheet'
  mode: 'create' | 'edit'
  createDraft?: { startAt: string; endAt: string }
  editDraft?: ActivityFormViewModel
  /** Create-mode prefill: the active municipality filter. Edit mode ignores it. */
  agendaState?: ActivityAgendaState
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  knownTags?: string[]
  onClose: () => void
  onSaved: () => void
}

const ActivityOverlayForm = ({
  variant,
  mode,
  createDraft,
  editDraft,
  agendaState,
  municipalityOptions,
  organizationOptions,
  knownTags,
  onClose,
  onSaved,
}: ActivityOverlayFormProps) => {
  const sheet = variant === 'sheet'
  const isEdit = mode === 'edit'
  const initialStartIso = isEdit ? editDraft?.startAt : createDraft?.startAt
  const initialEndIso = isEdit ? editDraft?.endAt : createDraft?.endAt
  const [title, setTitle] = useState(isEdit ? (editDraft?.title ?? '') : '')
  const [start, setStart] = useState(
    initialStartIso ? formatIsoAsBahiaDateTimeInput(initialStartIso) : '',
  )
  const [end, setEnd] = useState(initialEndIso ? formatIsoAsBahiaDateTimeInput(initialEndIso) : '')
  const [allDay, setAllDay] = useState(isEdit ? Boolean(editDraft?.allDay) : false)
  const [locality, setLocality] = useState(isEdit ? (editDraft?.locality ?? '') : '')
  const initialMunicipalityId = isEdit ? editDraft?.municipalityId : agendaState?.municipality
  const [municipalityValue, setMunicipalityValue] = useState(
    initialMunicipalityId &&
      municipalityOptions.some((option) => option.id === initialMunicipalityId)
      ? String(initialMunicipalityId)
      : '',
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [failedMessage, setFailedMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const errorFor = (name: string) => fieldErrors[name]?.[0]

  const allDayStartDate = start.slice(0, 10)
  const allDayEndDate = end ? end.slice(0, 10) : allDayStartDate

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const trimmedTitle = title.trim()
    const municipalityId = Number(municipalityValue)
    const startIso = parseBahiaDateTimeInput(start)
    const endIso = end ? parseBahiaDateTimeInput(end) : undefined

    const nextFieldErrors: Record<string, string[]> = {}
    if (!isEdit && !trimmedTitle) {
      nextFieldErrors.title = ['Informe o título do compromisso.']
    } else if (!isEdit && trimmedTitle.length < 2) {
      nextFieldErrors.title = ['Informe um título com ao menos 2 caracteres.']
    }
    if (!municipalityId) nextFieldErrors.municipality = ['Informe o município.']
    if (allDay) {
      if (!startIso) nextFieldErrors.startAt = ['Informe a data de início do compromisso.']
      if (startIso && endIso && !allDayRangeValid(startIso, endIso)) {
        nextFieldErrors.endAt = ['A data de término deve ser igual ou posterior à de início.']
      }
    } else {
      if (!startIso)
        nextFieldErrors.startAt = ['Informe a data e horário de início do compromisso.']
      if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
        nextFieldErrors.endAt = ['O horário de término deve ser posterior ao de início.']
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setFieldErrors({})
    setFailedMessage(null)
    setSaving(true)
    try {
      const result = isEdit
        ? await updateActivityOverlay(formData)
        : await createActivityOverlay(formData)
      if (result.ok) {
        onSaved()
        return
      }
      setSaving(false)
      setFieldErrors(result.fieldErrors ?? {})
      setFailedMessage(result.message)
      toast.error(result.message)
    } catch {
      setSaving(false)
      setFailedMessage(ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE)
      toast.error(ACTIVITY_OVERLAY_GENERIC_FAILURE_MESSAGE)
    }
  }

  const startEndFields = (
    <>
      <OverlayDateTimeField
        sheet={sheet}
        id="overlay-startAt"
        label="Início"
        value={start}
        onValueChange={setStart}
        invalid={Boolean(errorFor('startAt'))}
        error={errorFor('startAt')}
        required
        timeVisible={!allDay}
      />
      <OverlayDateTimeField
        sheet={sheet}
        id="overlay-endAt"
        label="Término"
        value={end}
        onValueChange={setEnd}
        invalid={Boolean(errorFor('endAt'))}
        error={errorFor('endAt')}
        timeVisible={!allDay}
      />
    </>
  )

  const basicInfoSection = (
    <>
      <Field data-invalid={Boolean(errorFor('title'))}>
        <FieldLabel htmlFor="overlay-title" className={sheet ? 'sr-only' : undefined}>
          Título *
        </FieldLabel>
        <Input
          id="overlay-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={160}
          minLength={2}
          readOnly={isEdit}
          placeholder={sheet ? 'Adicionar título *' : 'Ex.: Café com apoiadores'}
          className={sheet ? `min-h-11 ${sheetFieldInputClass}` : 'min-h-11'}
          autoComplete="off"
          aria-invalid={Boolean(errorFor('title'))}
          aria-describedby={errorFor('title') ? 'overlay-title-error' : undefined}
        />
        {errorFor('title') ? (
          <FieldError id="overlay-title-error">{errorFor('title')}</FieldError>
        ) : null}
      </Field>

      <div className={sheet ? 'py-1.5' : undefined}>
        <Field>
          <FieldLabel className={sheet ? 'sr-only' : undefined}>Tags</FieldLabel>
          <ActivityTagInput
            initialTags={isEdit ? (editDraft?.tags ?? []) : []}
            knownTags={knownTags}
            compact={sheet}
            placeholder={sheet ? 'Adicionar tags' : undefined}
            error={errorFor('tagsJson')}
          />
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="overlay-description" className={sheet ? 'sr-only' : undefined}>
          Descrição
        </FieldLabel>
        <Textarea
          id="overlay-description"
          name="description"
          defaultValue={isEdit ? (editDraft?.description ?? '') : ''}
          maxLength={4000}
          className={sheet ? 'min-h-24 rounded-none border-0 px-0' : 'min-h-24'}
          placeholder={sheet ? 'Descrição' : undefined}
        />
      </Field>

      <Field
        orientation="horizontal"
        className={
          sheet ? 'min-h-11 gap-2 rounded-none border-0 px-0' : 'min-h-11 rounded-lg border p-3'
        }
      >
        <Checkbox
          name="deputyPresent"
          defaultChecked={isEdit ? editDraft?.deputyPresent : false}
          aria-label="Deputado presente"
        />
        <span>Deputado presente</span>
      </Field>
    </>
  )

  const scheduleSection = (
    <>
      <Field
        orientation="horizontal"
        className={
          sheet ? 'min-h-11 gap-2 rounded-none border-0 px-0' : 'min-h-11 rounded-lg border p-3'
        }
      >
        <Checkbox
          checked={allDay}
          onCheckedChange={(next) => setAllDay(Boolean(next))}
          aria-label="Todo o dia"
        />
        <span>Todo o dia</span>
      </Field>

      {sheet ? startEndFields : <div className="grid gap-3 sm:grid-cols-2">{startEndFields}</div>}
    </>
  )

  const whereSection = (
    <>
      <Field data-invalid={Boolean(errorFor('municipality'))}>
        <FieldLabel htmlFor="overlay-municipality" className={sheet ? 'sr-only' : undefined}>
          Município *
        </FieldLabel>
        <StrictCombobox
          id="overlay-municipality"
          options={inlineMunicipalityOptions(municipalityOptions)}
          value={municipalityValue}
          onValueChange={setMunicipalityValue}
          error={errorFor('municipality')}
          placeholder={sheet ? 'Município *' : undefined}
          className={sheet ? 'min-h-11 rounded-none border-0' : undefined}
        />
        {errorFor('municipality') ? (
          <FieldError id="overlay-municipality-error">{errorFor('municipality')}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(errorFor('locality'))}>
        <FieldLabel htmlFor="overlay-locality" className={sheet ? 'sr-only' : undefined}>
          Local (opcional)
        </FieldLabel>
        <Input
          id="overlay-locality"
          name="locality"
          value={locality}
          onChange={(event) => setLocality(event.target.value)}
          maxLength={160}
          placeholder={sheet ? 'Local (opcional)' : 'Bairro, endereço ou referência'}
          className={sheet ? `min-h-11 ${sheetFieldInputClass}` : 'min-h-11'}
        />
        {errorFor('locality') ? (
          <FieldError id="overlay-locality-error">{errorFor('locality')}</FieldError>
        ) : null}
      </Field>
    </>
  )

  const peopleSection = (
    <>
      <ResponsibleMultiSelect
        name="responsiblesJson"
        label="Responsáveis"
        value={isEdit ? (editDraft?.responsibles ?? []) : []}
        error={errorFor('responsiblesJson')}
        description="Quem conduz este compromisso: equipe da campanha, liderança ou dobradinha — um ou vários."
        labelClassName={sheet ? 'sr-only' : undefined}
        emptyText={sheet ? 'Adicionar responsáveis' : undefined}
        search={searchActivityResponsibleOptionsAction}
        triggerClassName={
          sheet
            ? 'rounded-none border-0 bg-transparent px-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/30'
            : undefined
        }
      />

      <RelationMultiSelect
        name="organizations"
        label="Organizações apoiadoras"
        options={organizationOptions}
        initialSelectedIDs={isEdit ? (editDraft?.organizationIDs ?? []) : []}
        error={errorFor('organizations')}
        placeholder="Adicionar organização…"
      />
    </>
  )

  const tasksSection = (
    <ActivityTaskFields
      initialTasks={isEdit ? (editDraft?.tasks ?? []) : []}
      searchContacts={searchActivityContactOptions}
      error={errorFor('tasksJson')}
    />
  )

  const demandsSection = <ActivityDemandFields error={errorFor('demandsJson')} />

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={sheet ? 'flex min-h-0 flex-1 flex-col' : 'flex flex-col'}
    >
      {isEdit ? <input type="hidden" name="id" value={editDraft?.id ?? ''} /> : null}
      <input type="hidden" name="status" value="confirmado" />
      {allDay ? <input type="hidden" name="allDay" value="on" /> : null}
      <input type="hidden" name="startAt" value={allDay ? allDayStartDate : start} />
      <input type="hidden" name="endAt" value={allDay ? allDayEndDate : end} />
      <input type="hidden" name="municipality" value={municipalityValue} />

      <div
        className={
          sheet
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6'
            : 'max-h-[calc(100dvh-14rem)] flex-1 overflow-y-auto overscroll-contain p-6'
        }
      >
        {sheet ? (
          <div className="divide-y divide-border">
            {basicInfoSection}
            {scheduleSection}
            {whereSection}
            <div className="py-1.5">{peopleSection}</div>
            <div className="py-1.5">{tasksSection}</div>
            <div className="py-1.5">{demandsSection}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Informações básicas</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">{basicInfoSection}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data e horário</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">{scheduleSection}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Onde</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">{whereSection}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pessoas e organizações</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">{peopleSection}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tarefas</CardTitle>
              </CardHeader>
              <CardContent>{tasksSection}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Demandas</CardTitle>
              </CardHeader>
              <CardContent>{demandsSection}</CardContent>
            </Card>
          </div>
        )}

        {failedMessage ? (
          <Alert variant="destructive" className={sheet ? undefined : 'mt-5'}>
            <AlertDescription>{failedMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div
        className={
          sheet
            ? 'flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3'
            : 'flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4'
        }
      >
        {isEdit && editDraft ? (
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={`/campanha/atividades/${editDraft.slug}`}>Ver detalhes</Link>
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="min-h-11">
            {saving ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {isEdit ? 'Salvar alterações' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export const ActivityOverlay = ({
  request,
  isNarrow,
  agendaState,
  municipalityOptions,
  organizationOptions,
  knownTags,
  onClose,
  onSaved,
}: ActivityOverlayProps) => {
  const [editDraft, setEditDraft] = useState<ActivityFormViewModel | 'loading' | 'error' | null>(
    null,
  )
  const isEdit = request?.kind === 'edit'
  const activityId = isEdit ? request.activityId : null

  useEffect(() => {
    if (!isEdit || activityId === null) return
    let cancelled = false
    setEditDraft('loading')
    loadActivityEditDraft(activityId)
      .then((viewModel) => {
        if (!cancelled) setEditDraft(viewModel)
      })
      .catch(() => {
        if (!cancelled) setEditDraft('error')
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, activityId])

  if (!request) return null

  const sheetTitle = isEdit ? 'Editar atividade' : 'Nova atividade'

  const dialog = (children: ReactNode) =>
    isNarrow ? (
      <Drawer open onOpenChange={(next) => (next ? undefined : onClose())} swipeDirection="up">
        <DrawerContent className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)]">
          <DrawerHeader>
            <DrawerTitle>{sheetTitle}</DrawerTitle>
            {request.kind === 'create' ? (
              <DrawerDescription>{formatBahiaDateTimeLabel(request.startAt)}</DrawerDescription>
            ) : editDraft && editDraft !== 'loading' && editDraft !== 'error' ? (
              <DrawerDescription>{editDraft.title}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    ) : (
      <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{isEdit ? 'Editar atividade' : 'Nova atividade'}</DialogTitle>
            {request.kind === 'create' ? (
              <DialogDescription>{formatBahiaDateTimeLabel(request.startAt)}</DialogDescription>
            ) : null}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )

  if (isEdit) {
    if (editDraft === 'loading' || editDraft === null) {
      return dialog(
        <div className="flex min-h-48 flex-1 items-center justify-center" role="status">
          <Spinner aria-hidden="true" />
          <span className="sr-only">Carregando compromisso…</span>
        </div>,
      )
    }
    if (editDraft === 'error') {
      return dialog(
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-muted-foreground">
            Não foi possível carregar este compromisso. Tente novamente.
          </p>
        </div>,
      )
    }
    return dialog(
      <ActivityOverlayForm
        variant={isNarrow ? 'sheet' : 'modal'}
        mode="edit"
        editDraft={editDraft}
        agendaState={agendaState}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        knownTags={knownTags}
        onClose={onClose}
        onSaved={onSaved}
      />,
    )
  }

  return dialog(
    <ActivityOverlayForm
      variant={isNarrow ? 'sheet' : 'modal'}
      mode="create"
      createDraft={{ startAt: request.startAt, endAt: request.endAt }}
      agendaState={agendaState}
      municipalityOptions={municipalityOptions}
      organizationOptions={organizationOptions}
      knownTags={knownTags}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )
}
