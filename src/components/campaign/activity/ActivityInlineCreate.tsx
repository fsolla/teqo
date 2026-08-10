'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { searchActivityResponsibleOptionsAction } from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { createActivityInline } from '@/app/(campaign)/campanha/actions/activity'
import { ActivityDateTimeField } from '@/components/campaign/activity/ActivityDateTimeField'
import { ActivityTagInput } from '@/components/campaign/activity/ActivityTagInput'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { ResponsibleMultiSelect } from '@/components/campaign/shared/ResponsibleMultiSelect'
import { StrictCombobox } from '@/components/campaign/shared/StrictCombobox'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { allDayEndInstant, allDayRangeValid, allDayStartInstant } from '@/lib/activityAllDay'
import {
  formatBahiaDateTimeLabel,
  formatIsoAsBahiaDateTimeInput,
  parseBahiaDateTimeInput,
} from '@/lib/campaignTime'
import { activityResponsibleSchema, type ActivityCreateInput } from '@/lib/schemas/activity'
import { buildActivityCreateHref, type ActivityAgendaState } from '@/utilities/activityUi'
import type { StrictComboboxOption } from '@/utilities/territory/territoryComboboxOptions'

/**
 * C91 — the Google-Calendar-like quick create anchored on a calendar slot.
 * One content component is rendered inside a Popover (desktop, anchored at the
 * click) or a bottom Drawer (mobile); saving never navigates and the parent
 * refetches the visible window (`onCreated`).
 *
 * C103 — on narrow viewports the drawer opens from the TOP (`swipeDirection="up"`)
 * filling the usable height, the form switches to a label-less list variant
 * (placeholders + divider rows, `sr-only` labels) with a fixed footer, and the
 * date/time picker opens as a nested bottom sheet.
 */

export type ActivityInlineCreateDraft = {
  startAt: string
  endAt: string
  anchor: { x: number; y: number } | null
}

type ActivityInlineCreateProps = {
  draft: ActivityInlineCreateDraft | null
  isNarrow: boolean
  agendaState: ActivityAgendaState
  municipalityOptions: RelationOption[]
  knownTags?: string[]
  onClose: () => void
  onCreated: () => void
}

const inlineMunicipalityOptions = (options: RelationOption[]): StrictComboboxOption[] =>
  options.map((option) => ({ value: String(option.id), label: option.name }))

/**
 * Bounded JSON-array read for the inline sheet's `responsiblesJson` hidden
 * input: same 4 KB cap as the full form's `boundedJsonFormValue`, fail-closed
 * on malformed or oversized payloads (the component generates the JSON, so a
 * violation means tampering, not user input).
 */
const INLINE_JSON_MAX_BYTES = 4_000

const parseInlineJsonArray = (raw: FormDataEntryValue | null): unknown[] | undefined => {
  if (typeof raw !== 'string' || raw.length > INLINE_JSON_MAX_BYTES) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined
  } catch {
    return undefined
  }
}

const parseInlineResponsibles = (
  raw: FormDataEntryValue | null,
): ActivityCreateInput['responsible'] => {
  const parsed = parseInlineJsonArray(raw)
  if (!parsed) return undefined

  const entries: Array<{
    relationTo: 'campaignUser' | 'leadership' | 'stateDeputy'
    value: number
  }> = []
  for (const item of parsed) {
    const result = activityResponsibleSchema.safeParse(item)
    if (result.success) entries.push(result.data)
  }
  return entries.length > 0 ? entries : undefined
}

/** List-row styling for the label-less mobile sheet (C103). The focus ring is
 * kept (subtle) so keyboard users keep a visible focus indicator. */
const sheetFieldInputClass =
  'rounded-none border-0 bg-transparent px-0 py-0 focus-visible:ring-2 focus-visible:ring-primary/30'

type InlineDateTimeFieldProps = {
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

const InlineDateTimeField = ({
  sheet,
  id,
  label,
  value,
  onValueChange,
  invalid,
  error,
  required = false,
  timeVisible = true,
}: InlineDateTimeFieldProps) => (
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
      // The sheet variant implies the narrow viewport (C103); the picker keeps
      // the popover whenever the create overlay is a popover.
      isNarrow={sheet}
      label={label}
      required={required}
      timeVisible={timeVisible}
    />
    {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
  </Field>
)

const ActivityInlineCreateForm = ({
  startAt,
  endAt,
  agendaState,
  municipalityOptions,
  knownTags,
  variant,
  onCreated,
}: {
  startAt: string
  endAt: string
  agendaState: ActivityAgendaState
  municipalityOptions: RelationOption[]
  knownTags?: string[]
  variant: 'popover' | 'sheet'
  onCreated: () => void
}) => {
  const sheet = variant === 'sheet'
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(formatIsoAsBahiaDateTimeInput(startAt))
  const [end, setEnd] = useState(formatIsoAsBahiaDateTimeInput(endAt))
  const [allDay, setAllDay] = useState(false)
  const [locality, setLocality] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const preselectedMunicipalityId =
    agendaState.municipality &&
    municipalityOptions.some((option) => option.id === agendaState.municipality)
      ? String(agendaState.municipality)
      : ''
  const [municipalityValue, setMunicipalityValue] = useState(preselectedMunicipalityId)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [failedMessage, setFailedMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const errorFor = (name: string) => fieldErrors[name]?.[0]

  const allDayStartDate = start.slice(0, 10)
  const allDayEndDate = end ? end.slice(0, 10) : allDayStartDate

  // C105 — the href mirrors the LIVE state (times edited in the sheet, typed
  // tags), not the slot draft, so "Mais detalhes" carries everything the user
  // actually filled.
  const moreDetailsHref = buildActivityCreateHref(agendaState, {
    ...(allDay
      ? { allDay: true, startAt: allDayStartDate, endAt: allDayEndDate }
      : {
          startAt: parseBahiaDateTimeInput(start) ?? undefined,
          endAt: end ? (parseBahiaDateTimeInput(end) ?? undefined) : undefined,
        }),
    municipalityId: municipalityValue ? Number(municipalityValue) : undefined,
    title: title.trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const trimmedTitle = title.trim()
    const municipalityId = Number(municipalityValue)
    const startIso = parseBahiaDateTimeInput(start)
    const endIso = end ? parseBahiaDateTimeInput(end) : undefined

    const nextFieldErrors: Record<string, string[]> = {}
    if (!trimmedTitle) {
      nextFieldErrors.title = ['Informe o título do compromisso.']
    } else if (trimmedTitle.length < 2) {
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
      const responsible = parseInlineResponsibles(formData.get('responsiblesJson'))
      const result = await createActivityInline({
        title: trimmedTitle,
        municipality: municipalityId,
        ...(allDay
          ? {
              allDay: true,
              startAt: allDayStartInstant(allDayStartDate),
              ...(end ? { endAt: allDayEndInstant(allDayEndDate) } : {}),
            }
          : {
              startAt: startIso as string,
              ...(endIso ? { endAt: endIso } : {}),
            }),
        ...(locality.trim() ? { locality: locality.trim() } : {}),
        ...(responsible ? { responsible } : {}),
        // C105 — the tags mirror state (every chip mutation fires `onChange`),
        // so the payload reads the same source the "Mais detalhes" href uses.
        ...(tags.length > 0 ? { tags } : {}),
      })
      if (result.ok) {
        onCreated()
        return
      }
      setSaving(false)
      setFieldErrors(result.fieldErrors ?? {})
      setFailedMessage(result.message)
      toast.error(result.message)
    } catch {
      setSaving(false)
      const message = 'Não foi possível criar o compromisso. Tente novamente.'
      setFailedMessage(message)
      toast.error(message)
    }
  }

  const startEndFields = (
    <>
      <InlineDateTimeField
        sheet={sheet}
        id="inline-startAt"
        label="Início"
        value={start}
        onValueChange={setStart}
        invalid={Boolean(errorFor('startAt'))}
        error={errorFor('startAt')}
        required
        timeVisible={!allDay}
      />
      <InlineDateTimeField
        sheet={sheet}
        id="inline-endAt"
        label="Término"
        value={end}
        onValueChange={setEnd}
        invalid={Boolean(errorFor('endAt'))}
        error={errorFor('endAt')}
        timeVisible={!allDay}
      />
    </>
  )

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={sheet ? 'flex min-h-0 flex-1 flex-col' : 'flex flex-col gap-4'}
    >
      <div
        className={
          sheet
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6'
            : 'flex flex-col gap-4'
        }
      >
        <div className={sheet ? 'divide-y divide-border' : undefined}>
          <Field data-invalid={Boolean(errorFor('title'))}>
            <FieldLabel htmlFor="inline-title" className={sheet ? 'sr-only' : undefined}>
              Título *
            </FieldLabel>
            <Input
              id="inline-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              minLength={2}
              placeholder={sheet ? 'Adicionar título *' : 'Ex.: Café com apoiadores'}
              className={sheet ? `min-h-11 ${sheetFieldInputClass}` : 'min-h-11'}
              autoComplete="off"
              aria-invalid={Boolean(errorFor('title'))}
              aria-describedby={errorFor('title') ? 'inline-title-error' : undefined}
            />
            {errorFor('title') ? (
              <FieldError id="inline-title-error">{errorFor('title')}</FieldError>
            ) : null}
          </Field>

          {/* C104 — all-day toggle: hides the time part of Início/Término. */}
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

          {sheet ? (
            startEndFields
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">{startEndFields}</div>
          )}

          <Field data-invalid={Boolean(errorFor('municipality'))}>
            <FieldLabel htmlFor="inline-municipality" className={sheet ? 'sr-only' : undefined}>
              Município *
            </FieldLabel>
            <StrictCombobox
              id="inline-municipality"
              options={inlineMunicipalityOptions(municipalityOptions)}
              value={municipalityValue}
              onValueChange={setMunicipalityValue}
              error={errorFor('municipality')}
              placeholder={sheet ? 'Município *' : undefined}
              className={sheet ? 'min-h-11 rounded-none border-0' : undefined}
            />
            {errorFor('municipality') ? (
              <FieldError id="inline-municipality-error">{errorFor('municipality')}</FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="inline-locality" className={sheet ? 'sr-only' : undefined}>
              Local (opcional)
            </FieldLabel>
            <Input
              id="inline-locality"
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              maxLength={160}
              placeholder={sheet ? 'Local (opcional)' : 'Bairro, endereço ou referência'}
              className={sheet ? `min-h-11 ${sheetFieldInputClass}` : 'min-h-11'}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="inline-locality" className={sheet ? 'sr-only' : undefined}>
              Local (opcional)
            </FieldLabel>
            <Input
              id="inline-locality"
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              maxLength={160}
              placeholder={sheet ? 'Local (opcional)' : 'Bairro, endereço ou referência'}
              className={sheet ? `min-h-11 ${sheetFieldInputClass}` : 'min-h-11'}
            />
          </Field>

          <div className={sheet ? 'py-1.5' : undefined}>
            <Field>
              <FieldLabel className={sheet ? 'sr-only' : undefined}>Tags</FieldLabel>
              <ActivityTagInput
                knownTags={knownTags}
                onChange={setTags}
                compact={sheet}
                placeholder={sheet ? 'Adicionar tags' : undefined}
              />
            </Field>
          </div>

          <ResponsibleMultiSelect
            name="responsiblesJson"
            label="Responsáveis"
            search={searchActivityResponsibleOptionsAction}
            labelClassName={sheet ? 'sr-only' : undefined}
            emptyText={sheet ? 'Adicionar responsáveis' : undefined}
            triggerClassName={
              sheet
                ? 'rounded-none border-0 bg-transparent px-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/30'
                : undefined
            }
          />
        </div>

        {failedMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{failedMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div
        className={
          sheet
            ? 'flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3'
            : 'mt-1 flex items-center justify-between gap-3 border-t pt-3'
        }
      >
        <Button asChild variant="ghost" className="min-h-11">
          <Link href={moreDetailsHref}>Mais detalhes</Link>
        </Button>
        <Button type="submit" disabled={saving} className="min-h-11">
          {saving ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
    </form>
  )
}

export const ActivityInlineCreate = ({
  draft,
  isNarrow,
  agendaState,
  municipalityOptions,
  knownTags,
  onClose,
  onCreated,
}: ActivityInlineCreateProps) => {
  if (!draft) return null

  if (isNarrow) {
    return (
      <Drawer open onOpenChange={(next) => (next ? undefined : onClose())} swipeDirection="up">
        <DrawerContent className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)]">
          <DrawerHeader>
            <DrawerTitle>Nova atividade</DrawerTitle>
            <DrawerDescription>{formatBahiaDateTimeLabel(draft.startAt)}</DrawerDescription>
          </DrawerHeader>
          <ActivityInlineCreateForm
            startAt={draft.startAt}
            endAt={draft.endAt}
            agendaState={agendaState}
            municipalityOptions={municipalityOptions}
            knownTags={knownTags}
            variant="sheet"
            onCreated={onCreated}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open onOpenChange={(next) => (next ? undefined : onClose())}>
      <div
        className="fixed size-0"
        style={{ left: draft.anchor?.x ?? 0, top: draft.anchor?.y ?? 0 }}
        aria-hidden="true"
      >
        <PopoverAnchor />
      </div>
      {/* C105 — the tags field made the sheet taller. The height is capped at
          the space Radix computed for the current placement
          (`--radix-popper-available-height`, set by its `size` middleware):
          the sheet always fits the viewport on its placed side and scrolls
          internally instead of clipping fields off-screen (a static cap is
          not enough — Radix runs shift before flip, so an overflowing
          popover can end up with its top fields out of view). */}
      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-h-(--radix-popper-available-height) w-96 overflow-y-auto p-4"
      >
        <ActivityInlineCreateForm
          startAt={draft.startAt}
          endAt={draft.endAt}
          agendaState={agendaState}
          municipalityOptions={municipalityOptions}
          knownTags={knownTags}
          variant="popover"
          onCreated={onCreated}
        />
      </PopoverContent>
    </Popover>
  )
}
