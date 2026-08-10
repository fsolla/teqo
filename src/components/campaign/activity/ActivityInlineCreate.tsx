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

const ActivityInlineCreateForm = ({
  startAt,
  endAt,
  agendaState,
  municipalityOptions,
  knownTags,
  onCreated,
}: {
  startAt: string
  endAt: string
  agendaState: ActivityAgendaState
  municipalityOptions: RelationOption[]
  knownTags?: string[]
  onCreated: () => void
}) => {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(formatIsoAsBahiaDateTimeInput(startAt))
  const [end, setEnd] = useState(formatIsoAsBahiaDateTimeInput(endAt))
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

  // C105 — the href mirrors the LIVE state (times edited in the sheet, typed
  // tags), not the slot draft, so "Mais detalhes" carries everything the user
  // actually filled.
  const moreDetailsHref = buildActivityCreateHref(agendaState, {
    startAt: parseBahiaDateTimeInput(start) ?? undefined,
    endAt: end ? (parseBahiaDateTimeInput(end) ?? undefined) : undefined,
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
    if (!startIso) nextFieldErrors.startAt = ['Informe a data e horário de início do compromisso.']
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      nextFieldErrors.endAt = ['O horário de término deve ser posterior ao de início.']
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
        startAt: startIso as string,
        ...(endIso ? { endAt: endIso } : {}),
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

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field data-invalid={Boolean(errorFor('title'))}>
        <FieldLabel htmlFor="inline-title">Título *</FieldLabel>
        <Input
          id="inline-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={160}
          minLength={2}
          placeholder="Ex.: Café com apoiadores"
          className="min-h-11"
          autoComplete="off"
          aria-invalid={Boolean(errorFor('title'))}
          aria-describedby={errorFor('title') ? 'inline-title-error' : undefined}
        />
        {errorFor('title') ? (
          <FieldError id="inline-title-error">{errorFor('title')}</FieldError>
        ) : null}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={Boolean(errorFor('startAt'))}>
          <FieldLabel htmlFor="inline-startAt">Início *</FieldLabel>
          <ActivityDateTimeField
            id="inline-startAt"
            value={start}
            onValueChange={setStart}
            invalid={Boolean(errorFor('startAt'))}
            errorId={errorFor('startAt') ? 'inline-startAt-error' : undefined}
          />
          {errorFor('startAt') ? (
            <FieldError id="inline-startAt-error">{errorFor('startAt')}</FieldError>
          ) : null}
        </Field>
        <Field data-invalid={Boolean(errorFor('endAt'))}>
          <FieldLabel htmlFor="inline-endAt">Término</FieldLabel>
          <ActivityDateTimeField
            id="inline-endAt"
            value={end}
            onValueChange={setEnd}
            invalid={Boolean(errorFor('endAt'))}
            errorId={errorFor('endAt') ? 'inline-endAt-error' : undefined}
          />
          {errorFor('endAt') ? (
            <FieldError id="inline-endAt-error">{errorFor('endAt')}</FieldError>
          ) : null}
        </Field>
      </div>

      <Field data-invalid={Boolean(errorFor('municipality'))}>
        <FieldLabel htmlFor="inline-municipality">Município *</FieldLabel>
        <StrictCombobox
          id="inline-municipality"
          options={inlineMunicipalityOptions(municipalityOptions)}
          value={municipalityValue}
          onValueChange={setMunicipalityValue}
          error={errorFor('municipality')}
        />
        {errorFor('municipality') ? (
          <FieldError id="inline-municipality-error">{errorFor('municipality')}</FieldError>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="inline-locality">Local (opcional)</FieldLabel>
        <Input
          id="inline-locality"
          value={locality}
          onChange={(event) => setLocality(event.target.value)}
          maxLength={160}
          placeholder="Bairro, endereço ou referência"
          className="min-h-11"
        />
      </Field>

      <Field>
        <FieldLabel>Tags</FieldLabel>
        <ActivityTagInput knownTags={knownTags} onChange={setTags} />
      </Field>

      <ResponsibleMultiSelect
        name="responsiblesJson"
        label="Responsáveis"
        search={searchActivityResponsibleOptionsAction}
      />

      {failedMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{failedMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-1 flex items-center justify-between gap-3 border-t pt-3">
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

  const form = (
    <ActivityInlineCreateForm
      startAt={draft.startAt}
      endAt={draft.endAt}
      agendaState={agendaState}
      municipalityOptions={municipalityOptions}
      knownTags={knownTags}
      onCreated={onCreated}
    />
  )

  if (isNarrow) {
    return (
      <Drawer open onOpenChange={(next) => (next ? undefined : onClose())} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nova atividade</DrawerTitle>
            <DrawerDescription>{formatBahiaDateTimeLabel(draft.startAt)}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">{form}</div>
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
        {form}
      </PopoverContent>
    </Popover>
  )
}
