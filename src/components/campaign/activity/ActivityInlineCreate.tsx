'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { searchActivityResponsibleOptionsAction } from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { createActivityInline } from '@/app/(campaign)/campanha/actions/activity'
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
  onClose: () => void
  onCreated: () => void
}

const inlineMunicipalityOptions = (options: RelationOption[]): StrictComboboxOption[] =>
  options.map((option) => ({ value: String(option.id), label: option.name }))

const parseInlineResponsibles = (
  raw: FormDataEntryValue | null,
): ActivityCreateInput['responsible'] => {
  if (typeof raw !== 'string') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return undefined

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
  onCreated,
}: {
  startAt: string
  endAt: string
  agendaState: ActivityAgendaState
  municipalityOptions: RelationOption[]
  onCreated: () => void
}) => {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(formatIsoAsBahiaDateTimeInput(startAt))
  const [end, setEnd] = useState(formatIsoAsBahiaDateTimeInput(endAt))
  const [locality, setLocality] = useState('')
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

  const moreDetailsHref = buildActivityCreateHref(agendaState, {
    startAt,
    endAt,
    municipalityId: municipalityValue ? Number(municipalityValue) : undefined,
    title: title.trim() || undefined,
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
          <Input
            id="inline-startAt"
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="min-h-11"
            aria-invalid={Boolean(errorFor('startAt'))}
            aria-describedby={errorFor('startAt') ? 'inline-startAt-error' : undefined}
          />
          {errorFor('startAt') ? (
            <FieldError id="inline-startAt-error">{errorFor('startAt')}</FieldError>
          ) : null}
        </Field>
        <Field data-invalid={Boolean(errorFor('endAt'))}>
          <FieldLabel htmlFor="inline-endAt">Término</FieldLabel>
          <Input
            id="inline-endAt"
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="min-h-11"
            aria-invalid={Boolean(errorFor('endAt'))}
            aria-describedby={errorFor('endAt') ? 'inline-endAt-error' : undefined}
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
      <PopoverContent align="start" sideOffset={8} className="w-96 p-4">
        {form}
      </PopoverContent>
    </Popover>
  )
}
