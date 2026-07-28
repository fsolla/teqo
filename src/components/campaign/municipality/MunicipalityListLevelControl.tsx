'use client'

import { useEffect, useRef, useState } from 'react'

import type {
  MunicipalityListEngagementLevelResponse,
  MunicipalityListSavedEngagementLevel,
} from '@/app/(campaign)/campanha/(app)/municipios/engagement-level/types'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH,
  engagementLevelRank,
  engagementLevels,
  formatEngagementLevelLabel,
  getEngagementLevelViolations,
  isEngagementLevel,
  type EngagementLevel,
  type EngagementLevelViolation,
} from '@/lib/engagementLevel'
import { cn } from '@/lib/utils'

const ENGAGEMENT_LEVEL_ENDPOINT = '/campanha/municipios/engagement-level'
const SAVE_ERROR_MESSAGE = 'Não foi possível registrar o nível. Tente novamente.'

type MunicipalityListLevelControlProps = {
  municipalityID: number
  municipalityName: string
  level: EngagementLevel | null
  levelNote: string | null
  levelChangedAt: string | null
}

/**
 * E14 — unlike the trend and estimate popovers next to it, this one submits
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
}: MunicipalityListLevelControlProps) => {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<MunicipalityListSavedEngagementLevel | null>(
    level ? { level, note: levelNote, changedAt: levelChangedAt } : null,
  )
  // Seeded by `resetDraft` on every open; while closed the popover body — and
  // with it the select — is not mounted.
  const [draftLevel, setDraftLevel] = useState<EngagementLevel | ''>('')
  const [note, setNote] = useState('')
  const [reversalSignals, setReversalSignals] = useState('')
  const [triangulatedShock, setTriangulatedShock] = useState(false)
  const [override, setOverride] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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
    setSaved(level ? { level, note: levelNote, changedAt: levelChangedAt } : null)
  }, [level, levelNote, levelChangedAt])

  useEffect(() => () => abortRef.current?.abort(), [])

  const currentLevel = saved?.level ?? null
  const currentNote = saved?.note ?? null
  const isMovement = draftLevel !== '' && draftLevel !== currentLevel

  // The rules are pure and client-safe, so the coordinator sees why a movement
  // is held before submitting it — the server re-runs them either way, and what
  // it raises on top (a concurrent move this tab has not seen) joins the list
  // rather than turning into an error string with no override next to it.
  const localViolations = isMovement
    ? getEngagementLevelViolations({
        from: currentLevel,
        to: draftLevel,
        levelChangedAt: saved?.changedAt ?? null,
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
    Math.abs(engagementLevelRank[draftLevel] - engagementLevelRank[currentLevel]) > 1

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
      const response = await fetch(ENGAGEMENT_LEVEL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          municipalityId: municipalityID,
          level: draftLevel,
          note,
          reversalSignals,
          triangulatedShock,
          override,
        }),
      })

      const payload = (await response.json()) as MunicipalityListEngagementLevelResponse

      if (payload.status === 'success') {
        setSaved(payload.savedLevel)
        setOpen(false)
        return
      }

      // A blocked movement keeps the popover open with the draft intact: the
      // next click is "override", not "type it all again".
      if (payload.status === 'blocked') {
        setServerBlock({ level: draftLevel, violations: payload.violations })
        return
      }

      setErrorMessage(payload.message)
    } catch {
      setErrorMessage(SAVE_ERROR_MESSAGE)
    } finally {
      setIsPending(false)
    }
  }

  const canSubmit = isMovement && note.trim().length > 0 && reversalSignals.trim().length > 0
  const fieldId = (suffix: string) => `municipality-list-level-${suffix}-${municipalityID}`

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <CampaignHoverTooltip
        content={
          currentLevel ? (
            <div className="space-y-1">
              <p>{formatEngagementLevelLabel(currentLevel)}</p>
              {currentNote ? <p className="whitespace-pre-wrap">{currentNote}</p> : null}
            </div>
          ) : null
        }
        align="start"
        openOnTouch={false}
        disabled={open}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              'min-h-11 rounded-md px-1 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              open ? 'bg-muted/60' : undefined,
            )}
            aria-label={`Nível de envolvimento de ${municipalityName}: ${
              currentLevel ? formatEngagementLevelLabel(currentLevel) : EMPTY_ENGAGEMENT_LEVEL_LABEL
            }`}
          >
            <MunicipalityLevelBadge level={currentLevel} layout="table" />
          </button>
        </PopoverTrigger>
      </CampaignHoverTooltip>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
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
            <Field orientation="horizontal">
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
              <Field orientation="horizontal">
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
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit || isPending || (violations.length > 0 && !override)}
            onClick={() => void submit()}
          >
            {isPending ? <Spinner className="size-3.5" aria-hidden /> : null}
            Registrar movimento
          </Button>
          <p className="sr-only" aria-live="polite">
            {isPending ? 'Registrando nível.' : (errorMessage ?? '')}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
