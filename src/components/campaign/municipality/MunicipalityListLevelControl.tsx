'use client'

import { useEffect, useRef, useState } from 'react'

import type { MunicipalityListEngagementLevelResponse } from '@/app/(campaign)/campanha/(app)/municipios/engagement-level/types'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellFailureChannel } from '@/components/campaign/shared/useCampaignCellFailureChannel'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DrawerCloseButton } from '@/components/ui/Drawer'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  ENGAGEMENT_LEVEL_RULES,
  ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH,
  engagementLevelRank,
  engagementLevels,
  formatEngagementLevelLabel,
  getEngagementLevelViolations,
  isEngagementLevel,
  type EngagementLevel,
  type EngagementLevelViolation,
} from '@/lib/engagementLevel'

const ENGAGEMENT_LEVEL_ENDPOINT = '/campanha/municipios/engagement-level'
const SAVE_ERROR_MESSAGE = 'Não foi possível registrar o nível. Tente novamente.'

type MunicipalityListLevelControlProps = {
  municipalityID: number
  municipalityName: string
  level: EngagementLevel | null
  levelNote: string | null
  levelChangedAt: string | null
  variant: CampaignCellEditOverlayVariant
}

/**
 * E14 — unlike the trend and estimate cells next to it, this one submits
 * explicitly: a movement carries a motivo AND the signals that would reverse
 * it, and it may need an override. Auto-saving half of that would file an
 * incomplete decision under the coordinator's name.
 */
export const MunicipalityListLevelControl = ({
  municipalityID,
  municipalityName,
  level,
  levelNote,
  levelChangedAt,
  variant,
}: MunicipalityListLevelControlProps) => {
  const [open, setOpen] = useState(false)
  // Not the route's success payload: that one always names a level, and a row
  // need not have one.
  const [saved, setSaved] = useState<{
    level: EngagementLevel | null
    note: string | null
    changedAt: string | null
  }>({
    level,
    note: levelNote,
    changedAt: levelChangedAt,
  })
  // Seeded by `resetDraft` on every open; while closed the overlay body — and
  // with it the select — is not mounted.
  const [draftLevel, setDraftLevel] = useState<EngagementLevel | ''>('')
  const [note, setNote] = useState('')
  const [reversalSignals, setReversalSignals] = useState('')
  const [triangulatedShock, setTriangulatedShock] = useState(false)
  const [override, setOverride] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const { errorMessage, setErrorMessage, reportFailure, noteOpenChange } =
    useCampaignCellFailureChannel()
  // Violations only the server could know (it re-reads the município under the
  // lock), kept with the level they were raised for so a changed draft drops them.
  const [serverBlock, setServerBlock] = useState<{
    level: EngagementLevel
    violations: EngagementLevelViolation[]
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastPropsRef = useRef({ level, levelNote, levelChangedAt })

  // Adopt the server value when it changes from outside (navigation / refresh).
  useEffect(() => {
    const last = lastPropsRef.current
    if (
      last.level === level &&
      last.levelNote === levelNote &&
      last.levelChangedAt === levelChangedAt
    )
      return
    lastPropsRef.current = { level, levelNote, levelChangedAt }
    setSaved({ level, note: levelNote, changedAt: levelChangedAt })
  }, [level, levelNote, levelChangedAt])

  useEffect(() => () => abortRef.current?.abort(), [])

  const currentLevel = saved.level
  const currentNote = saved.note
  const currentLabel = currentLevel
    ? formatEngagementLevelLabel(currentLevel)
    : EMPTY_ENGAGEMENT_LEVEL_LABEL
  const isMovement = draftLevel !== '' && draftLevel !== currentLevel

  // The rules are pure and client-safe, so the coordinator sees why a movement
  // is held before submitting it — the server re-runs them either way, and what
  // it raises on top (a concurrent move this tab has not seen) joins the list
  // rather than turning into an error string with no override next to it.
  const localViolations = isMovement
    ? getEngagementLevelViolations({
        from: currentLevel,
        to: draftLevel,
        levelChangedAt: saved.changedAt,
        now: new Date(),
        triangulatedShock,
      })
    : []
  const violations =
    serverBlock && serverBlock.level === draftLevel
      ? [
          ...localViolations,
          ...serverBlock.violations.filter(
            (violation) => !localViolations.some((local) => local.id === violation.id),
          ),
        ]
      : localViolations

  const isJump =
    isMovement &&
    currentLevel !== null &&
    Math.abs(engagementLevelRank[draftLevel] - engagementLevelRank[currentLevel]) >
      ENGAGEMENT_LEVEL_RULES.maxStepsWithoutShock

  const resetDraft = () => {
    setDraftLevel(currentLevel ?? '')
    setNote('')
    setReversalSignals('')
    setTriangulatedShock(false)
    setOverride(false)
    setErrorMessage(null)
    setServerBlock(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetDraft()
    noteOpenChange(nextOpen)
    setOpen(nextOpen)
  }

  const submit = async () => {
    if (!isMovement || isPending) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsPending(true)
    setErrorMessage(null)
    setServerBlock(null)

    try {
      // Deliberately ignores the transport's `ok` the way the siblings do not:
      // `blocked` arrives as a 409 carrying the violations the coordinator may
      // override, so the status line is not the signal here — the discriminant is.
      const { payload } = await postCampaignJson<MunicipalityListEngagementLevelResponse>(
        ENGAGEMENT_LEVEL_ENDPOINT,
        {
          municipalityId: municipalityID,
          level: draftLevel,
          note,
          reversalSignals,
          triangulatedShock,
          override,
        },
        controller.signal,
      )

      if (payload.status === 'success') {
        setSaved(payload.savedLevel)
        handleOpenChange(false)
        return
      }

      // A blocked movement keeps the overlay open with the draft intact: the
      // next click is "override", not "type it all again".
      if (payload.status === 'blocked') {
        setServerBlock({ level: draftLevel, violations: payload.violations })
        return
      }

      reportFailure(payload.message)
    } catch {
      // Network failure, a non-JSON error page, or the unmount abort below —
      // only the first two have anyone left to tell.
      if (controller.signal.aborted) return
      reportFailure(SAVE_ERROR_MESSAGE)
    } finally {
      setIsPending(false)
    }
  }

  const canSubmit =
    isMovement &&
    note.trim().length > 0 &&
    reversalSignals.trim().length > 0 &&
    (violations.length === 0 || override)
  const fieldId = (suffix: string) => `municipality-list-level-${suffix}-${municipalityID}`
  const isSheet = variant === 'sheet'
  const submitButton = (
    <Button
      type="button"
      size={isSheet ? 'default' : 'sm'}
      className={isSheet ? 'min-h-11 w-full' : undefined}
      disabled={!canSubmit || isPending}
      onClick={() => void submit()}
    >
      {isPending ? <Spinner className="size-3.5" aria-hidden /> : null}
      Registrar movimento
    </Button>
  )

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={handleOpenChange}
      title="Registrar nível de envolvimento"
      description={municipalityName}
      triggerLabel={`Nível de envolvimento de ${municipalityName}: ${currentLabel}`}
      triggerBusy={isPending}
      statusMessage={isPending ? 'Registrando nível.' : (errorMessage ?? '')}
      footer={
        isSheet && open ? (
          <>
            {submitButton}
            <DrawerCloseButton>Cancelar</DrawerCloseButton>
          </>
        ) : undefined
      }
      tooltipContent={
        currentLevel ? (
          <div className="space-y-1">
            <p>{currentLabel}</p>
            {currentNote ? <p className="whitespace-pre-wrap">{currentNote}</p> : null}
          </div>
        ) : null
      }
      contentClassName="w-80 p-3"
      preventPopoverAutoFocus
      trigger={
        // The sheet has no hover to carry the rest, so the trigger spells the
        // level out there and stays the bare numeral in the table.
        <MunicipalityLevelBadge
          level={currentLevel}
          note={isSheet ? currentNote : null}
          layout={isSheet ? 'card' : 'table'}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={fieldId('select')}>Nível de envolvimento</FieldLabel>
          <NativeSelect
            id={fieldId('select')}
            value={draftLevel}
            onChange={(event) =>
              setDraftLevel(isEngagementLevel(event.target.value) ? event.target.value : '')
            }
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">{EMPTY_ENGAGEMENT_LEVEL_LABEL}</NativeSelectOption>
            {engagementLevels.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {formatEngagementLevelLabel(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId('note')}>Motivo</FieldLabel>
          <Textarea
            id={fieldId('note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH}
            rows={2}
            className="min-h-16 resize-y"
            placeholder="O que mudou para justificar este nível?"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId('reversal')}>O que faria voltar atrás</FieldLabel>
          <Textarea
            id={fieldId('reversal')}
            value={reversalSignals}
            onChange={(event) => setReversalSignals(event.target.value)}
            maxLength={ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH}
            rows={2}
            className="min-h-16 resize-y"
            placeholder="Sinais que fariam rever esta decisão."
          />
        </Field>
        {isJump ? (
          <Field orientation="horizontal" className={isSheet ? 'min-h-11' : undefined}>
            <Checkbox
              id={fieldId('shock')}
              checked={triangulatedShock}
              onCheckedChange={(checked) => setTriangulatedShock(checked === true)}
            />
            <FieldContent>
              <FieldLabel htmlFor={fieldId('shock')}>
                Choque triangulado (dois níveis de uma vez)
              </FieldLabel>
            </FieldContent>
          </Field>
        ) : null}
        {violations.length > 0 ? (
          <>
            <Alert className="py-2">
              <AlertDescription className="text-xs">
                <ul className="list-disc space-y-1 pl-4">
                  {violations.map((violation) => (
                    <li key={violation.id}>{violation.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
            <Field orientation="horizontal" className={isSheet ? 'min-h-11' : undefined}>
              <Checkbox
                id={fieldId('override')}
                checked={override}
                onCheckedChange={(checked) => setOverride(checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor={fieldId('override')}>
                  Registrar mesmo assim, ciente das ressalvas
                </FieldLabel>
              </FieldContent>
            </Field>
          </>
        ) : null}
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {/* On touch the same button is pinned to the footer, out of a body
            that scrolls past it. */}
        {isSheet ? null : submitButton}
      </div>
    </CampaignCellEditOverlay>
  )
}
