'use client'

import { useEffect, useMemo, useState } from 'react'

import type {
  MunicipalityListPoliticalTrendResponse,
  MunicipalityListSavedPoliticalTrend,
} from '@/app/(campaign)/campanha/(app)/municipios/political-trend/types'
import { municipalitiesCollection } from '@/components/campaign/opsSync/opsMirrorClient'
import { enqueuePoliticalTrend } from '@/components/campaign/opsSync/opsMunicipalityOutbox'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { parsePoliticalTrendStatusFormValue } from '@/lib/schemas/municipality'
import {
  politicalTrendBadgeVariant,
  politicalTrendLabels,
} from '@/utilities/municipality/municipalityLabels'

const NOTE_AUTOSAVE_MS = 600
const STATUS_AUTOSAVE_MS = 150
const POLITICAL_TREND_ENDPOINT = '/campanha/municipios/political-trend'
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar a tendência. Tente novamente.'
const NOTE_MAX_LENGTH = 2000

const normalizeNote = (note: string | null | undefined): string | null => {
  const trimmed = note?.trim()
  return trimmed ? trimmed : null
}

const trendsEqual = (
  left: MunicipalityListSavedPoliticalTrend,
  right: MunicipalityListSavedPoliticalTrend,
): boolean => left.status === right.status && normalizeNote(left.note) === normalizeNote(right.note)

type MunicipalityListTrendControlProps = {
  municipalityID: number
  municipalityName: string
  status: MunicipalityListSavedPoliticalTrend['status']
  trendNote: string | null
  /** CAS base for outbox writes. */
  updatedAt?: string
  variant: CampaignCellEditOverlayVariant
}

export const MunicipalityListTrendControl = ({
  municipalityID,
  municipalityName,
  status,
  trendNote,
  updatedAt,
  variant,
}: MunicipalityListTrendControlProps) => {
  const { open, onOpenChange, value, change, flush, isPending, errorMessage, statusMessage } =
    useCampaignCellAutosave<
      MunicipalityListSavedPoliticalTrend,
      MunicipalityListPoliticalTrendResponse
    >({
      // Memoized because the hook's server-adoption effect keys on this
      // reference; a fresh literal per render would run it (harmlessly, since
      // `equals` guards the body) on every commit of the list.
      value: useMemo(() => ({ status, note: normalizeNote(trendNote) }), [status, trendNote]),
      equals: trendsEqual,
      endpoint: POLITICAL_TREND_ENDPOINT,
      buildBody: (trend) => ({
        municipalityId: municipalityID,
        status: trend.status,
        note: trend.note,
      }),
      readSaved: (payload) => payload.savedTrend,
      errorMessage: SAVE_ERROR_MESSAGE,
      pendingMessage: 'Salvando tendência.',
      persist: async (trend) => {
        const mirrorUpdatedAt = municipalitiesCollection.get(municipalityID)?.updatedAt
        await enqueuePoliticalTrend({
          municipalityId: municipalityID,
          status: trend.status,
          note: trend.note,
          baseUpdatedAt: mirrorUpdatedAt ?? updatedAt,
        })
        return {
          ok: true,
          payload: {
            status: 'success',
            message: 'Tendência política registrada.',
            savedTrend: trend,
          },
        }
      },
    })

  // The only state the hook cannot hold: the textarea's raw text, which the
  // saved note is the trimmed form of. It follows the saved note whenever that
  // changes for a reason other than this typing (adoption, revert, server echo)
  // and is left alone while the two still agree, so trailing spaces survive.
  const [noteDraft, setNoteDraft] = useState(trendNote ?? '')
  useEffect(() => {
    setNoteDraft((current) =>
      normalizeNote(current) === value.note ? current : (value.note ?? ''),
    )
  }, [value.note])

  const hasNote = Boolean(value.note)
  const trendLabel = value.status ? politicalTrendLabels[value.status] : 'Não registrada'

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Editar tendência"
      description={municipalityName}
      // The label names the current reading: an `aria-label` replaces the
      // badge's own text, so without it the trigger would announce the verb and
      // swallow the value every sighted user reads off the pill. Same shape as
      // `MunicipalityListSignalControl`'s.
      triggerLabel={`Editar tendência política em ${municipalityName} — ${trendLabel}`}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      tooltipContent={hasNote ? <p className="whitespace-pre-wrap">{value.note}</p> : null}
      contentClassName="w-72 p-3"
      preventPopoverAutoFocus
      trigger={
        value.status ? (
          <Badge variant={politicalTrendBadgeVariant[value.status]}>{trendLabel}</Badge>
        ) : (
          <Badge variant="outline">{trendLabel}</Badge>
        )
      }
    >
      <div className="relative flex flex-col gap-3">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando tendência"
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor={`municipality-list-trend-${municipalityID}`}>Tendência</FieldLabel>
          <NativeSelect
            id={`municipality-list-trend-${municipalityID}`}
            value={value.status ?? ''}
            onChange={(event) =>
              change(
                (current) => ({
                  ...current,
                  status: parsePoliticalTrendStatusFormValue(event.target.value || undefined),
                }),
                STATUS_AUTOSAVE_MS,
              )
            }
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">Não registrada</NativeSelectOption>
            {(Object.keys(politicalTrendLabels) as Array<keyof typeof politicalTrendLabels>).map(
              (trendStatus) => (
                <NativeSelectOption key={trendStatus} value={trendStatus}>
                  {politicalTrendLabels[trendStatus]}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`municipality-list-trend-note-${municipalityID}`}>
            Justificativa
          </FieldLabel>
          <Textarea
            id={`municipality-list-trend-note-${municipalityID}`}
            value={noteDraft}
            onChange={(event) => {
              setNoteDraft(event.target.value)
              // Updater, not a literal: `value.status` here is the render that
              // scheduled this keystroke, so a select change batched into the
              // same tick would be overwritten by its predecessor.
              change(
                (current) => ({ ...current, note: normalizeNote(event.target.value) }),
                NOTE_AUTOSAVE_MS,
              )
            }}
            onBlur={flush}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            className="min-h-20 resize-y"
            placeholder="Por que essa leitura?"
          />
        </Field>
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </CampaignCellEditOverlay>
  )
}
