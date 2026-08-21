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
  MUNICIPALITY_UPDATE_BODY_REQUIRED_MESSAGE,
  municipalityUpdatePolarityLabels,
  type MunicipalityUpdatePolarity,
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
  resolveMunicipalityV2UpdateState,
  type MunicipalityV2StatusViewModel,
} from '@/utilities/municipality/municipalityV2StatusView'

const ENGAGEMENT_LEVEL_ENDPOINT = '/campanha/municipios/engagement-level'
const POLITICAL_TREND_ENDPOINT = '/campanha/municipios/political-trend'
const LEVEL_ERROR = 'Não foi possível registrar o nível. Tente novamente.'
const TREND_ERROR = 'Não foi possível salvar a tendência. Tente novamente.'
const UPDATE_ERROR = 'Não foi possível registrar a atualização. Tente novamente.'

type PendingAxis = 'level' | 'trend' | 'update' | null

type MunicipalityV2StatusStripProps = {
  status: MunicipalityV2StatusViewModel
  signalFormAction: (formData: FormData) => Promise<CampaignFormActionState>
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`): nível/tendência/polaridade render as static values with no selects. */
  readOnly?: boolean
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

const polarityOptions: readonly MunicipalityUpdatePolarity[] = ['boa', 'neutra', 'ruim']

export const MunicipalityV2StatusStrip = ({
  status,
  signalFormAction,
  readOnly = false,
}: MunicipalityV2StatusStripProps) => {
  const router = useRouter()
  const formId = useId()
  const abortRef = useRef<AbortController | null>(null)

  const [level, setLevel] = useState<EngagementLevel | null>(status.engagementLevel)
  const [levelNote, setLevelNote] = useState(status.levelNote)
  const [levelChangedAt, setLevelChangedAt] = useState(status.levelChangedAt)
  const [trendStatus, setTrendStatus] = useState(status.politicalTrendStatus)
  const [trendNote, setTrendNote] = useState(status.politicalTrendNote)
  const [polarity, setPolarity] = useState(status.lastUpdatePolarity)
  const [updateBody, setUpdateBody] = useState(status.lastUpdateBody)
  const [lastSignalAt, setLastSignalAt] = useState(status.lastSignalAt)

  const [pendingAxis, setPendingAxis] = useState<PendingAxis>(null)
  const [draftLevel, setDraftLevel] = useState<EngagementLevel | null>(null)
  const [draftTrend, setDraftTrend] = useState<typeof trendStatus>(null)
  const [draftPolarity, setDraftPolarity] = useState<MunicipalityUpdatePolarity | null>(null)
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
    setPolarity(status.lastUpdatePolarity)
    setUpdateBody(status.lastUpdateBody)
    setLastSignalAt(status.lastSignalAt)
  }, [status])

  const updateSelect = resolveMunicipalityV2UpdateState({
    polarity,
    lastSignalAt,
  })
  const aggregate = buildMunicipalityV2StatusAggregate({
    levelNote,
    trendNote,
    updateBody,
    updatePolarity: polarity,
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
            triangulatedShock: false,
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
    setDraftPolarity(null)
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
          note: reason.trim() ? reason.trim() : null,
          triangulatedShock: false,
          override: false,
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
          note: reason.trim() ? reason.trim() : null,
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

  const confirmUpdate = async (reason: string) => {
    if (!draftPolarity || isPending) return
    const body = reason.trim()
    if (!body) {
      setErrorMessage(MUNICIPALITY_UPDATE_BODY_REQUIRED_MESSAGE)
      return
    }
    setIsPending(true)
    setErrorMessage(null)
    try {
      const formData = new FormData()
      formData.set('municipalityId', String(status.id))
      formData.set('polarity', draftPolarity)
      formData.set('body', body)
      formData.set('urgent', 'false')
      formData.set('adversarySignal', 'false')
      const result = await signalFormAction(formData)
      if (result.status !== 'success') {
        setErrorMessage(result.message || UPDATE_ERROR)
        return
      }
      setPolarity(draftPolarity)
      setUpdateBody(reason.trim() ? reason.trim() : null)
      setLastSignalAt(new Date().toISOString())
      closeDialog()
      router.refresh()
    } catch {
      setErrorMessage(UPDATE_ERROR)
    } finally {
      setIsPending(false)
    }
  }

  const dialogTitle =
    pendingAxis === 'level'
      ? 'Confirmar nível de envolvimento'
      : pendingAxis === 'trend'
        ? 'Confirmar tendência'
        : pendingAxis === 'update'
          ? 'Confirmar atualização'
          : ''

  const dialogDescription =
    pendingAxis === 'level' && draftLevel
      ? formatEngagementLevelLabel(draftLevel)
      : pendingAxis === 'trend'
        ? draftTrend
          ? politicalTrendLabels[draftTrend]
          : 'Não registrada'
        : pendingAxis === 'update' && draftPolarity
          ? municipalityUpdatePolarityLabels[draftPolarity]
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
          {status.canMoveEngagementLevel && !readOnly ? (
            <NativeSelect
              id={`${formId}-level`}
              className="min-h-11 w-full"
              value={level ?? ''}
              aria-busy={isPending && pendingAxis === 'level' ? true : undefined}
              onChange={(event) => {
                const next = event.target.value
                if (!isEngagementLevel(next) || next === level) {
                  event.target.value = level ?? ''
                  return
                }
                setDraftLevel(next)
                setPendingAxis('level')
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
          {readOnly ? (
            <p id={`${formId}-trend`} className="flex min-h-11 items-center text-sm">
              {trendStatus ? politicalTrendLabels[trendStatus] : 'Não registrada'}
            </p>
          ) : (
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
          )}
        </Field>

        <Field>
          <ConceptTooltip conceptId="pauta-do-silencio" label="Polaridade">
            <FieldLabel htmlFor={`${formId}-update`}>Polaridade</FieldLabel>
          </ConceptTooltip>
          {readOnly ? (
            <p id={`${formId}-update`} className="flex min-h-11 items-center text-sm">
              {updateSelect.label}
            </p>
          ) : (
            <NativeSelect
              id={`${formId}-update`}
              className="min-h-11 w-full"
              value={updateSelect.value}
              aria-busy={isPending && pendingAxis === 'update' ? true : undefined}
              onChange={(event) => {
                const raw = event.target.value
                if (raw === MUNICIPALITY_V2_SIGNAL_COLD_VALUE) {
                  event.target.value = updateSelect.value
                  return
                }
                const next = raw as MunicipalityUpdatePolarity
                if (!next || next === polarity) {
                  event.target.value = updateSelect.value
                  return
                }
                setDraftPolarity(next)
                setPendingAxis('update')
                setErrorMessage(null)
              }}
            >
              {updateSelect.isCold ? (
                <NativeSelectOption value={MUNICIPALITY_V2_SIGNAL_COLD_VALUE}>
                  {updateSelect.label}
                </NativeSelectOption>
              ) : null}
              {polarityOptions.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {municipalityUpdatePolarityLabels[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
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
                {formatMunicipalitySignalAgeLabel(updateSelect.ageInDays)}
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
        triangulatedShock={false}
        onTriangulatedShockChange={() => {}}
        violations={uniqueLevelViolations}
        override={false}
        onOverrideChange={() => {}}
        onConfirm={(reason) => {
          if (pendingAxis === 'level') void confirmLevel(reason)
          else if (pendingAxis === 'trend') void confirmTrend(reason)
          else if (pendingAxis === 'update') void confirmUpdate(reason)
        }}
      />
    </section>
  )
}
