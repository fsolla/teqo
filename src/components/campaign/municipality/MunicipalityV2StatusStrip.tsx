'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import type { MunicipalityListEngagementLevelResponse } from '@/app/(campaign)/campanha/(app)/municipios/engagement-level/types'
import type { MunicipalityListPoliticalTrendResponse } from '@/app/(campaign)/campanha/(app)/municipios/political-trend/types'
import { MunicipalityV2StatusReasonDialog } from '@/components/campaign/municipality/MunicipalityV2StatusReasonDialog'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { Badge } from '@/components/ui/Badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { campaignHoverExplanationClassName } from '@/lib/campaignHoverTooltip'
import { campaignConceptHref, campaignConceptOneLiner } from '@/lib/campaignIntelligenceConcepts'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  EMPTY_ENGAGEMENT_LEVEL_LABEL,
  ENGAGEMENT_LEVEL_RULES,
  engagementLevelRank,
  engagementLevels,
  formatEngagementLevelLabel,
  getEngagementLevelViolations,
  isEngagementLevel,
  type EngagementLevel,
  type EngagementLevelViolation,
} from '@/lib/engagementLevel'
import {
  parsePoliticalTrendStatusFormValue,
  politicalTrendStatuses,
} from '@/lib/schemas/municipality'
import {
  municipalitySignalTypeLabels,
  municipalitySignalTypes,
  parseMunicipalitySignalType,
  type MunicipalitySignalType,
} from '@/lib/schemas/municipalityUpdate'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatTerritorialClassWhy,
  politicalTrendLabels,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipality/municipalityLabels'
import { formatMunicipalitySignalAgeLabel } from '@/utilities/municipality/municipalitySignal'
import {
  buildMunicipalityV2StatusAggregate,
  MUNICIPALITY_V2_SIGNAL_COLD_VALUE,
  resolveMunicipalityV2SignalSelectState,
  type MunicipalityV2StatusViewModel,
} from '@/utilities/municipality/municipalityV2StatusView'

const ENGAGEMENT_LEVEL_ENDPOINT = '/campanha/municipios/engagement-level'
const POLITICAL_TREND_ENDPOINT = '/campanha/municipios/political-trend'
const LEVEL_ERROR = 'Não foi possível registrar o nível. Tente novamente.'
const TREND_ERROR = 'Não foi possível salvar a tendência. Tente novamente.'
const SIGNAL_ERROR = 'Não foi possível registrar o sinal. Tente novamente.'

type PendingAxis = 'level' | 'trend' | 'signal' | null

type MunicipalityV2StatusStripProps = {
  status: MunicipalityV2StatusViewModel
  signalFormAction: (formData: FormData) => Promise<CampaignFormActionState>
}

const ConceptTooltip = ({
  conceptId,
  label,
  children,
}: {
  conceptId: 'nivel-de-envolvimento' | 'classe-territorial' | 'pauta-do-silencio'
  label: string
  children: ReactNode
}) => (
  <CampaignHoverTooltip
    side="bottom"
    align="start"
    content={
      <div className="flex max-w-64 flex-col gap-2 text-sm">
        <p>{campaignConceptOneLiner(conceptId)}</p>
        <Link
          href={campaignConceptHref(conceptId)}
          className="font-medium underline underline-offset-2"
        >
          Ver em Conceitos
        </Link>
      </div>
    }
  >
    <button
      type="button"
      aria-label={`${label}: mais informações`}
      className={cn(
        'rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
        campaignHoverExplanationClassName,
      )}
    >
      {children}
    </button>
  </CampaignHoverTooltip>
)

export const MunicipalityV2StatusStrip = ({
  status,
  signalFormAction,
}: MunicipalityV2StatusStripProps) => {
  const router = useRouter()
  const formId = useId()
  const abortRef = useRef<AbortController | null>(null)

  const [level, setLevel] = useState<EngagementLevel | null>(status.engagementLevel)
  const [levelNote, setLevelNote] = useState(status.levelNote)
  const [levelChangedAt, setLevelChangedAt] = useState(status.levelChangedAt)
  const [trendStatus, setTrendStatus] = useState(status.politicalTrendStatus)
  const [trendNote, setTrendNote] = useState(status.politicalTrendNote)
  const [signalType, setSignalType] = useState(status.lastSignalType)
  const [signalBody, setSignalBody] = useState(status.lastSignalBody)
  const [lastSignalAt, setLastSignalAt] = useState(status.lastSignalAt)

  const [pendingAxis, setPendingAxis] = useState<PendingAxis>(null)
  const [draftLevel, setDraftLevel] = useState<EngagementLevel | null>(null)
  const [draftTrend, setDraftTrend] = useState<typeof trendStatus>(null)
  const [draftSignal, setDraftSignal] = useState<MunicipalitySignalType | null>(null)
  const [triangulatedShock, setTriangulatedShock] = useState(false)
  const [override, setOverride] = useState(false)
  const [serverBlock, setServerBlock] = useState<EngagementLevelViolation[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => () => abortRef.current?.abort(), [])

  // Adopt RSC refresh values when the server revalidates after a write.
  useEffect(() => {
    setLevel(status.engagementLevel)
    setLevelNote(status.levelNote)
    setLevelChangedAt(status.levelChangedAt)
    setTrendStatus(status.politicalTrendStatus)
    setTrendNote(status.politicalTrendNote)
    setSignalType(status.lastSignalType)
    setSignalBody(status.lastSignalBody)
    setLastSignalAt(status.lastSignalAt)
  }, [status])

  const signalSelect = resolveMunicipalityV2SignalSelectState({
    signalType,
    lastSignalAt,
  })
  const aggregate = buildMunicipalityV2StatusAggregate({
    levelNote,
    trendNote,
    signalBody,
    signalType,
    lastSignalAt,
    engagementLevel: level,
  })

  const levelViolations =
    pendingAxis === 'level' && draftLevel
      ? [
          ...getEngagementLevelViolations({
            from: level,
            to: draftLevel,
            levelChangedAt,
            now: new Date(),
            triangulatedShock,
          }),
          ...(serverBlock ?? []),
        ]
      : []
  const uniqueLevelViolations = levelViolations.filter(
    (violation, index, list) => list.findIndex((item) => item.id === violation.id) === index,
  )
  const isJump =
    pendingAxis === 'level' &&
    draftLevel !== null &&
    level !== null &&
    Math.abs(engagementLevelRank[draftLevel] - engagementLevelRank[level]) >
      ENGAGEMENT_LEVEL_RULES.maxStepsWithoutShock

  const closeDialog = () => {
    setPendingAxis(null)
    setDraftLevel(null)
    setDraftTrend(null)
    setDraftSignal(null)
    setTriangulatedShock(false)
    setOverride(false)
    setServerBlock(null)
    setErrorMessage(null)
  }

  const confirmLevel = async (reason: string) => {
    if (!draftLevel || isPending) return
    const controller = new AbortController()
    abortRef.current = controller
    setIsPending(true)
    setErrorMessage(null)
    setServerBlock(null)
    try {
      const { payload } = await postCampaignJson<MunicipalityListEngagementLevelResponse>(
        ENGAGEMENT_LEVEL_ENDPOINT,
        {
          municipalityId: status.id,
          level: draftLevel,
          note: reason.trim() ? reason : null,
          triangulatedShock,
          override,
        },
        controller.signal,
      )
      if (payload.status === 'success') {
        setLevel(payload.savedLevel.level)
        setLevelNote(payload.savedLevel.note)
        setLevelChangedAt(payload.savedLevel.changedAt)
        closeDialog()
        router.refresh()
        return
      }
      if (payload.status === 'blocked') {
        setServerBlock(payload.violations)
        return
      }
      setErrorMessage(payload.message || LEVEL_ERROR)
    } catch {
      if (controller.signal.aborted) return
      setErrorMessage(LEVEL_ERROR)
    } finally {
      setIsPending(false)
    }
  }

  const confirmTrend = async (reason: string) => {
    if (pendingAxis !== 'trend' || isPending) return
    const controller = new AbortController()
    abortRef.current = controller
    setIsPending(true)
    setErrorMessage(null)
    try {
      const { payload } = await postCampaignJson<MunicipalityListPoliticalTrendResponse>(
        POLITICAL_TREND_ENDPOINT,
        {
          municipalityId: status.id,
          status: draftTrend,
          note: reason.trim() ? reason : null,
        },
        controller.signal,
      )
      if (payload.status === 'success') {
        setTrendStatus(payload.savedTrend.status)
        setTrendNote(payload.savedTrend.note)
        closeDialog()
        router.refresh()
        return
      }
      setErrorMessage(payload.message || TREND_ERROR)
    } catch {
      if (controller.signal.aborted) return
      setErrorMessage(TREND_ERROR)
    } finally {
      setIsPending(false)
    }
  }

  const confirmSignal = async (reason: string) => {
    if (!draftSignal || isPending) return
    setIsPending(true)
    setErrorMessage(null)
    try {
      const formData = new FormData()
      formData.set('municipalityId', String(status.id))
      formData.set('municipalitySlug', status.slug)
      formData.set('signalType', draftSignal)
      if (reason.trim()) formData.set('body', reason.trim())
      const result = await signalFormAction(formData)
      if (result.status !== 'success') {
        setErrorMessage(result.message || SIGNAL_ERROR)
        return
      }
      setSignalType(draftSignal)
      setSignalBody(reason.trim() ? reason.trim() : null)
      setLastSignalAt(new Date().toISOString())
      closeDialog()
      router.refresh()
    } catch {
      setErrorMessage(SIGNAL_ERROR)
    } finally {
      setIsPending(false)
    }
  }

  const dialogTitle =
    pendingAxis === 'level'
      ? 'Confirmar nível de envolvimento'
      : pendingAxis === 'trend'
        ? 'Confirmar tendência'
        : pendingAxis === 'signal'
          ? 'Confirmar sinal'
          : ''

  const dialogDescription =
    pendingAxis === 'level' && draftLevel
      ? formatEngagementLevelLabel(draftLevel)
      : pendingAxis === 'trend'
        ? draftTrend
          ? politicalTrendLabels[draftTrend]
          : 'Não registrada'
        : pendingAxis === 'signal' && draftSignal
          ? municipalitySignalTypeLabels[draftSignal]
          : ''

  return (
    <section aria-labelledby={`${formId}-status-title`} className="flex flex-col gap-3">
      <h2 id={`${formId}-status-title`} className="text-base font-medium">
        Status
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <ConceptTooltip conceptId="nivel-de-envolvimento" label="Nível">
            <FieldLabel htmlFor={`${formId}-level`}>Nível</FieldLabel>
          </ConceptTooltip>
          {status.canMoveEngagementLevel ? (
            <NativeSelect
              id={`${formId}-level`}
              className="min-h-11 w-full"
              value={level ?? ''}
              aria-busy={isPending && pendingAxis === 'level' ? true : undefined}
              onChange={(event) => {
                const next = event.target.value
                if (!isEngagementLevel(next) || next === level) {
                  // Reset select to current when choosing empty / same.
                  event.target.value = level ?? ''
                  return
                }
                setDraftLevel(next)
                setPendingAxis('level')
                setTriangulatedShock(false)
                setOverride(false)
                setServerBlock(null)
                setErrorMessage(null)
              }}
            >
              <NativeSelectOption value="">{EMPTY_ENGAGEMENT_LEVEL_LABEL}</NativeSelectOption>
              {engagementLevels.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {formatEngagementLevelLabel(option)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <p id={`${formId}-level`} className="flex min-h-11 items-center text-sm">
              {level ? formatEngagementLevelLabel(level) : EMPTY_ENGAGEMENT_LEVEL_LABEL}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor={`${formId}-trend`}>Tendência</FieldLabel>
          <NativeSelect
            id={`${formId}-trend`}
            className="min-h-11 w-full"
            value={trendStatus ?? ''}
            aria-busy={isPending && pendingAxis === 'trend' ? true : undefined}
            onChange={(event) => {
              const next = parsePoliticalTrendStatusFormValue(event.target.value)
              if (next === trendStatus) return
              setDraftTrend(next)
              setPendingAxis('trend')
              setErrorMessage(null)
            }}
          >
            <NativeSelectOption value="">Não registrada</NativeSelectOption>
            {politicalTrendStatuses.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {politicalTrendLabels[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <ConceptTooltip conceptId="pauta-do-silencio" label="Sinal">
            <FieldLabel htmlFor={`${formId}-signal`}>Sinal</FieldLabel>
          </ConceptTooltip>
          <NativeSelect
            id={`${formId}-signal`}
            className="min-h-11 w-full"
            value={signalSelect.value}
            aria-busy={isPending && pendingAxis === 'signal' ? true : undefined}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === MUNICIPALITY_V2_SIGNAL_COLD_VALUE) {
                event.target.value = signalSelect.value
                return
              }
              const next = parseMunicipalitySignalType(raw)
              if (!next || next === signalType) {
                event.target.value = signalSelect.value
                return
              }
              setDraftSignal(next)
              setPendingAxis('signal')
              setErrorMessage(null)
            }}
          >
            {signalSelect.isCold ? (
              <NativeSelectOption value={MUNICIPALITY_V2_SIGNAL_COLD_VALUE}>
                {signalSelect.label}
              </NativeSelectOption>
            ) : null}
            {municipalitySignalTypes.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {municipalitySignalTypeLabels[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <div className="flex flex-col gap-2">
          <ConceptTooltip conceptId="classe-territorial" label="Classe territorial">
            <span className="text-sm font-medium">Classe</span>
          </ConceptTooltip>
          <div className="flex min-h-11 flex-wrap items-center gap-2">
            <Badge variant={territorialClassBadgeVariant[status.territorialClass.class]}>
              {territorialClassLabels[status.territorialClass.class]}
            </Badge>
            <ConceptTooltip conceptId="pauta-do-silencio" label="Frescor">
              <span className="text-xs text-muted-foreground">
                {formatMunicipalitySignalAgeLabel(signalSelect.ageInDays)}
              </span>
            </ConceptTooltip>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatTerritorialClassWhy(status.territorialClass.factors)}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" data-slot="status-aggregate">
        {aggregate}
      </p>

      <MunicipalityV2StatusReasonDialog
        open={pendingAxis !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
          }
        }}
        title={dialogTitle}
        description={dialogDescription}
        isPending={isPending}
        errorMessage={errorMessage}
        showTriangulatedShock={Boolean(isJump)}
        triangulatedShock={triangulatedShock}
        onTriangulatedShockChange={setTriangulatedShock}
        violations={uniqueLevelViolations}
        override={override}
        onOverrideChange={setOverride}
        onConfirm={(reason) => {
          if (pendingAxis === 'level') void confirmLevel(reason)
          else if (pendingAxis === 'trend') void confirmTrend(reason)
          else if (pendingAxis === 'signal') void confirmSignal(reason)
        }}
      />
    </section>
  )
}
