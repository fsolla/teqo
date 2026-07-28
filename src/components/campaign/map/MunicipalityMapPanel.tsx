'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useRef, useState, useTransition } from 'react'

import { BahiaMap, type BahiaMapFeatureInfo } from '@/components/campaign/map/BahiaMap'
import { ChoroplethLegend } from '@/components/campaign/map/ChoroplethLegend'
import { MapFeatureReadout } from '@/components/campaign/map/MapFeatureReadout'
import { MapScaleLegend } from '@/components/campaign/map/MapScaleLegend'
import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/municipality/MunicipalityEstimateScenarioContext'
import {
  VOTE_ESTIMATE_SCENARIO_MAP_HINT,
  VoteEstimateScenarioField,
} from '@/components/campaign/votePledge/VoteEstimateScenarioField'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  bubbleRadius,
  computeChoroplethMax,
  type ChoroplethFills,
  type ChoroplethValues,
} from '@/lib/bahiaMapStyle'
import type { CampaignConceptId } from '@/lib/campaignIntelligenceConcepts'
import {
  choroplethMaxValue,
  computeValidVoteShares,
  divergingGradientCss,
} from '@/lib/choroplethColorScale'
import { formatElectionNumber, formatPlacementOrdinal } from '@/lib/electionFormat'
import {
  buildCompetitiveRankClassing,
  buildLqClassing,
  buildQuantileClassing,
  fillsForClassing,
  QUANTILE_CLASSES,
  QUANTILE_MIN_FEATURES_FOR_FULL_SPLIT,
} from '@/lib/mapScaleClasses'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import type { FederalCandidateOption } from '@/utilities/electionCandidateOptions'
import {
  formatDominanceAgainstOwnStandard,
  territorialClassLabels,
  territorialClassMapFill,
} from '@/utilities/municipalityLabels'
import {
  DEFAULT_MUNICIPALITY_MAP_SCALE_MODE,
  isMunicipalityMapScaleModeAvailable,
  MUNICIPALITY_MAP_SCALE_MODES,
  MUNICIPALITY_MAP_YEARS,
  municipalityMapScaleModeHints,
  municipalityMapScaleModeLabels,
  municipalityMapYearLabels,
  type MunicipalityMapBundle,
  type MunicipalityMapScaleMode,
  type MunicipalityMapYear,
} from '@/utilities/municipalityMapContract'
import type { MunicipalityTerritorialClass } from '@/utilities/municipalityTerritorialClass'

/** The legend's note doubles as the scale selector's description. */
const SCALE_NOTE_ID = 'municipality-map-scale-note'
const BUBBLE_TOGGLE_ID = 'municipality-map-bubbles'

/**
 * Scales that have their own glossary entry (E18). LQ is documented as
 * "dominância relativa" — the same ratio under the name the list already uses.
 */
const SCALE_CONCEPT_ID: Partial<Record<MunicipalityMapScaleMode, CampaignConceptId>> = {
  quantile: 'quantis-do-mapa',
  lq: 'dominancia-relativa',
  competitiveRank: 'posicao-no-municipio',
}

/** Reference sizes in the bubble key: the largest bubble and a quarter of it. */
const BUBBLE_KEY_FRACTIONS = [0.25, 1] as const

/**
 * Two encodings need decoding when the layer is on — how big the prize is
 * (area) and how he stands there (colour) — so the key carries both, with
 * real circles rather than a sentence about sizes nobody can eyeball.
 */
const MapBubbleKey = ({ largestValue }: { largestValue: number }) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <ul className="flex items-center gap-3" aria-label="Tamanho da bolha por votos em jogo">
        {BUBBLE_KEY_FRACTIONS.map((fraction) => {
          const diameter = 2 * bubbleRadius(fraction, 1)
          return (
            <li key={fraction} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="shrink-0 rounded-full bg-muted-foreground/70 ring-1 ring-background"
                style={{ width: diameter, height: diameter }}
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatElectionNumber(Math.round(largestValue * fraction))}
              </span>
            </li>
          )
        })}
      </ul>
      <ul
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
        aria-label="Cor da bolha por classe do município"
      >
        {Object.entries(territorialClassLabels).map(([territorialClass, label]) => (
          <li key={territorialClass} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full ring-1 ring-background"
              style={{
                backgroundColor:
                  territorialClassMapFill[territorialClass as MunicipalityTerritorialClass],
              }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </div>
    <p className="text-xs text-muted-foreground">
      Tamanho = votos válidos projetados para 2026, o que está em jogo ali. Cor = classe do
      município, a leitura da lista.
    </p>
  </div>
)

type MunicipalityMapPanelProps = {
  bundle: MunicipalityMapBundle
  candidateOptions: FederalCandidateOption[]
  defaultYear?: MunicipalityMapYear
}

export const MunicipalityMapPanel = ({
  bundle,
  candidateOptions,
  defaultYear = 2022,
}: MunicipalityMapPanelProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [year, setYear] = useState<MunicipalityMapYear>(defaultYear)
  const [scaleMode, setScaleMode] = useState<MunicipalityMapScaleMode>(
    DEFAULT_MUNICIPALITY_MAP_SCALE_MODE,
  )
  const [bubblesEnabled, setBubblesEnabled] = useState(false)
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const [localEstimateScenario, setLocalEstimateScenario] = useState<VoteEstimateScenario>(
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )
  const estimateScenario = scenarioContext?.scenario ?? localEstimateScenario
  const setEstimateScenario = scenarioContext?.setScenario ?? setLocalEstimateScenario

  const comparison = bundle.comparison
  const comparisonActive = comparison !== null && year !== 2026

  // Comparing forces the diverging absolute scale, and the competitive
  // placement has no 2026 reading (it is a TSE result). Rather than let the
  // select show a mode the map isn't painting, fall back — and the legend note
  // below says which mode stepped aside, so the fallback isn't silent.
  const effectiveScaleMode: MunicipalityMapScaleMode = comparisonActive
    ? 'absolute'
    : isMunicipalityMapScaleModeAvailable(scaleMode, year)
      ? scaleMode
      : DEFAULT_MUNICIPALITY_MAP_SCALE_MODE
  const percentScaleActive = effectiveScaleMode === 'percentValid'
  // The compare map already spends colour on two candidates; a third encoding
  // on top of it would be unreadable, so the bubbles step aside there.
  const showBubbles = bubblesEnabled && !comparisonActive

  const rawValues = useMemo(() => {
    if (comparisonActive && comparison) {
      return comparison.diffByYear[String(year)] ?? {}
    }
    if (year === 2026) {
      return bundle.values2026ByScenario[estimateScenario] ?? {}
    }
    return bundle.valuesByYear[String(year)] ?? {}
  }, [bundle, comparison, comparisonActive, estimateScenario, year])

  const validVotesForYear = useMemo(
    () => bundle.validVotesByYear[String(year)] ?? {},
    [bundle.validVotesByYear, year],
  )

  const displayValues = useMemo(() => {
    if (percentScaleActive) {
      return computeValidVoteShares(rawValues, validVotesForYear)
    }
    return rawValues
  }, [percentScaleActive, rawValues, validVotesForYear])

  const displayMax = useMemo(() => {
    const fillMode = comparisonActive ? 'diverging' : 'sequential'
    return computeChoroplethMax(displayValues, fillMode, percentScaleActive ? 1 : undefined)
  }, [comparisonActive, displayValues, percentScaleActive])

  const scopedKeys = useMemo(
    () => Object.keys(bundle.municipalitiesByMapKey),
    [bundle.municipalitiesByMapKey],
  )

  /** LQ per município against his statewide standard — the same ratio E10 classes on. */
  const lqByMapKey = useMemo(() => {
    const statewideShare = bundle.statewideShareByYear[String(year)] ?? 0
    if (statewideShare <= 0) return {}

    const lq: Record<string, number> = {}
    for (const [mapKey, votes] of Object.entries(rawValues)) {
      const validVotes = validVotesForYear[mapKey] ?? 0
      if (votes <= 0 || validVotes <= 0) continue
      lq[mapKey] = votes / validVotes / statewideShare
    }
    return lq
  }, [bundle.statewideShareByYear, rawValues, validVotesForYear, year])

  const competitiveRankForYear = useMemo(
    () => bundle.competitiveRankByYear[String(year)] ?? {},
    [bundle.competitiveRankByYear, year],
  )

  const classing = useMemo(() => {
    switch (effectiveScaleMode) {
      case 'quantile':
        return buildQuantileClassing(rawValues)
      case 'lq':
        return buildLqClassing(lqByMapKey)
      case 'competitiveRank':
        return buildCompetitiveRankClassing(
          Object.fromEntries(
            Object.entries(competitiveRankForYear).map(([mapKey, placement]) => [
              mapKey,
              placement.rank,
            ]),
          ),
        )
      default:
        return null
    }
  }, [competitiveRankForYear, effectiveScaleMode, lqByMapKey, rawValues])

  // A classing with no classes paints nothing, so the legend must fall through
  // to the continuous ramp — passing `{}` here would tell `BahiaMap` the map is
  // classed and grey out every polygon under a red gradient legend.
  const classed = classing !== null && classing.classes.length > 0
  const fillByKey = useMemo(
    () => (classed && classing ? fillsForClassing(classing) : undefined),
    [classed, classing],
  )

  /**
   * What the colour means, said ONCE and next to the swatches that need
   * decoding — putting it under the selector instead made the control column
   * taller than the title beside it, and repeated the sentence the legend was
   * already carrying.
   */
  const legendNote = useMemo(() => {
    const parts = [municipalityMapScaleModeHints[effectiveScaleMode]]

    if (!isMunicipalityMapScaleModeAvailable(scaleMode, year) && !comparisonActive) {
      parts.push(
        `${municipalityMapScaleModeLabels[scaleMode]} só existe nos anos com resultado do TSE, então ${year} volta para esta escala.`,
      )
    }

    if (classed && classing) {
      const painted = Object.keys(classing.classIndexByKey).length

      // One sentence for the coverage, not two: "N com votos" plus "M em
      // cinza" made the reader add them up to check they matched the scope.
      parts.push(
        painted === scopedKeys.length
          ? `Todos os ${formatElectionNumber(painted)} municípios do seu escopo entraram na escala.`
          : `${formatElectionNumber(painted)} de ${formatElectionNumber(scopedKeys.length)} municípios do seu escopo entraram na escala; os demais ficam em cinza.`,
      )

      if (effectiveScaleMode === 'quantile' && classing.classes.length < QUANTILE_CLASSES) {
        parts.push(
          painted < QUANTILE_MIN_FEATURES_FOR_FULL_SPLIT
            ? `São poucos para cinco faixas, então a escala usa ${classing.classes.length}.`
            : `Os valores se repetem demais para cinco faixas, então a escala usa ${classing.classes.length}.`,
        )
      }
      if (effectiveScaleMode === 'lq') {
        parts.push('1× é a média estadual dele, não a dos municípios em exibição.')
      }
      if (effectiveScaleMode === 'competitiveRank') {
        parts.push('Vale para a cidade inteira: em Salvador, as 19 zonas dividem a mesma posição.')
      }
    }

    return parts.join(' ')
  }, [classed, classing, comparisonActive, effectiveScaleMode, scaleMode, scopedKeys.length, year])

  const metricLabel = useMemo(() => {
    if (comparisonActive) {
      return `diferença de votos em ${year}`
    }
    if (percentScaleActive) {
      if (year === 2026) {
        return 'participação nos válidos 2022 (estimativas 2026)'
      }
      return `participação nos válidos (${year})`
    }
    if (year === 2026)
      return `votos estimados 2026 (${voteEstimateScenarioLabels[estimateScenario].toLowerCase()})`
    return `votos de ${bundle.candidateName} em ${year}`
  }, [bundle.candidateName, comparisonActive, estimateScenario, percentScaleActive, year])

  /**
   * Votes at stake, not votes won: the bubble asks "how big is the prize
   * here", which is a different question from the colour's "how is he doing
   * here" — reading them together is the point of the layer.
   *
   * Both sides are already stable references, so there is nothing to memoize.
   */
  const bubbleValues = showBubbles ? bundle.projectedValidVotesByMapKey : undefined

  const bubbleFillByKey = useMemo(() => {
    if (!showBubbles) return undefined
    const fills: ChoroplethFills = {}
    for (const [mapKey, territorialClass] of Object.entries(bundle.territorialClassByMapKey)) {
      fills[mapKey] = territorialClassMapFill[territorialClass]
    }
    return fills
  }, [bundle.territorialClassByMapKey, showBubbles])

  // The key's reference circles and the map's radius denominator have to be
  // the same number, or the key labels a size the map never draws.
  const largestBubbleValue = bubbleValues ? choroplethMaxValue(bubbleValues) : 0

  const bubbleReadingFor = useCallback(
    (key: string): string | null => {
      if (!showBubbles) return null

      const projected = bundle.projectedValidVotesByMapKey[key] ?? 0
      if (projected <= 0) return null

      const territorialClass = bundle.territorialClassByMapKey[key]
      const classLabel = territorialClass ? territorialClassLabels[territorialClass] : null
      return `${formatElectionNumber(projected)} válidos projetados em jogo${classLabel ? ` · ${classLabel}` : ''}`
    },
    [bundle.projectedValidVotesByMapKey, bundle.territorialClassByMapKey, showBubbles],
  )

  /**
   * The relative sentence for one município — the class alone ("Q4") is a
   * verdict without evidence, so the readout always spells out what the colour
   * means for the município under the cursor.
   */
  const relativeReadingFor = useCallback(
    (key: string): string | null => {
      if (!classing) return null

      const classIndex = classing.classIndexByKey[key]
      switch (effectiveScaleMode) {
        case 'quantile': {
          if (classIndex === undefined) return null
          const range = classing.classes[classIndex]?.label
          return `${classIndex + 1}ª de ${classing.classes.length} faixas${range ? ` (${range} votos)` : ''}`
        }
        case 'lq': {
          const lq = lqByMapKey[key]
          return lq === undefined ? null : formatDominanceAgainstOwnStandard(lq)
        }
        case 'competitiveRank': {
          const placement = competitiveRankForYear[key]
          if (!placement) return null
          return `${formatPlacementOrdinal(placement.rank)} entre ${formatElectionNumber(placement.candidates)} candidatos votados aqui`
        }
        default:
          return null
      }
    },
    [classing, competitiveRankForYear, effectiveScaleMode, lqByMapKey],
  )

  // Optimistic on the control, honest pending on the map: the comparison data
  // is a server round trip, so the select flips at once and the map region
  // dims until the refreshed bundle arrives.
  const [isComparePending, startCompareTransition] = useTransition()
  const [optimisticCompare, setOptimisticCompare] = useState<string | null>(null)
  const compareSelectValue =
    isComparePending && optimisticCompare !== null
      ? optimisticCompare
      : comparison
        ? String(comparison.candidateNumber)
        : ''

  const setCompare = (candidateNumber: string) => {
    setOptimisticCompare(candidateNumber)
    const params = new URLSearchParams(searchParams.toString())
    if (candidateNumber) params.set('compare', candidateNumber)
    else params.delete('compare')
    startCompareTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false })
    })
  }

  return (
    <section
      aria-labelledby="municipality-map-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="municipality-map-title" className="text-base font-medium">
            Mapa dos Municípios
          </h2>
          {/* What the map is made of stays here; what the COLOUR means is
              said once, next to the scale selector that decides it. */}
          <p className="text-sm text-muted-foreground">
            {comparisonActive && comparison
              ? `Comparação ${bundle.candidateName} × ${comparison.candidateName} em ${year}.`
              : `Votação de ${bundle.candidateName} por município — ${year === 2026 ? 'em 2026, pelas estimativas da campanha' : `em ${year}, pelo resultado do TSE`}.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="municipality-map-year">Ano</FieldLabel>
            <NativeSelect
              id="municipality-map-year"
              value={String(year)}
              onChange={(event) => setYear(Number(event.target.value) as MunicipalityMapYear)}
              className="min-h-11 w-full"
            >
              {MUNICIPALITY_MAP_YEARS.map((entry) => (
                <NativeSelectOption key={entry} value={String(entry)}>
                  {municipalityMapYearLabels[entry]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {!comparisonActive ? (
            <Field className="w-full sm:w-52">
              <FieldLabel htmlFor="municipality-map-scale">Escala</FieldLabel>
              <NativeSelect
                id="municipality-map-scale"
                value={effectiveScaleMode}
                onChange={(event) => setScaleMode(event.target.value as MunicipalityMapScaleMode)}
                className="min-h-11 w-full"
                aria-describedby={SCALE_NOTE_ID}
              >
                {MUNICIPALITY_MAP_SCALE_MODES.filter((mode) =>
                  isMunicipalityMapScaleModeAvailable(mode, year),
                ).map((mode) => (
                  <NativeSelectOption key={mode} value={mode}>
                    {municipalityMapScaleModeLabels[mode]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          {year === 2026 && !comparisonActive ? (
            <VoteEstimateScenarioField
              id="municipality-map-estimate-scenario"
              value={estimateScenario}
              onChange={setEstimateScenario}
              hint={VOTE_ESTIMATE_SCENARIO_MAP_HINT}
            />
          ) : null}
          <Field className="w-full sm:w-72">
            <FieldLabel htmlFor="municipality-map-compare">Comparar com</FieldLabel>
            <NativeSelect
              id="municipality-map-compare"
              value={compareSelectValue}
              onChange={(event) => setCompare(event.target.value)}
              className="min-h-11 w-full"
            >
              <NativeSelectOption value="">Sem comparação</NativeSelectOption>
              {candidateOptions.map((candidate) => (
                <NativeSelectOption
                  key={candidate.candidateNumber}
                  value={String(candidate.candidateNumber)}
                >
                  {candidate.name}
                  {candidate.party ? ` (${candidate.party})` : ''} — {candidate.candidateNumber}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>

      <div
        className="flex flex-col gap-4 transition-opacity data-[pending=true]:opacity-60"
        data-pending={isComparePending || undefined}
        aria-busy={isComparePending}
      >
        <p className="sr-only" aria-live="polite">
          {isComparePending ? 'Atualizando comparação…' : ''}
        </p>
        {comparisonActive && comparison ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">
                +{comparison.candidateName}
              </span>
              <div
                className="h-2.5 min-w-0 flex-1 rounded-full ring-1 ring-foreground/10"
                style={{ background: divergingGradientCss }}
                role="img"
                aria-label={`Escala divergente: azul onde ${comparison.candidateName} lidera, branco no empate, vermelho onde ${bundle.candidateName} lidera`}
              />
              <span className="shrink-0 text-xs text-muted-foreground">
                +{bundle.candidateName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Vermelho: {bundle.candidateName} na frente · Branco: empate · Azul:{' '}
              {comparison.candidateName} na frente. Comparação usa diferença absoluta.
            </p>
          </div>
        ) : classed && classing ? (
          <MapScaleLegend
            classing={classing}
            metricLabel={metricLabel}
            note={legendNote}
            noteId={SCALE_NOTE_ID}
            conceptID={SCALE_CONCEPT_ID[effectiveScaleMode]}
          />
        ) : displayMax > 0 ? (
          <ChoroplethLegend
            max={displayMax}
            metricLabel={metricLabel}
            formatMax={percentScaleActive ? () => '100%' : undefined}
            note={legendNote}
            noteId={SCALE_NOTE_ID}
          />
        ) : (
          <p id={SCALE_NOTE_ID} className="text-sm text-muted-foreground">
            Sem dados para este ano no seu escopo.
          </p>
        )}

        {/* A second encoding, so it is opt-in and its key only appears with it. */}
        {!comparisonActive ? (
          <div className="flex flex-col gap-2">
            <Field orientation="horizontal" className="min-h-11 w-fit">
              <Checkbox
                id={BUBBLE_TOGGLE_ID}
                checked={bubblesEnabled}
                onCheckedChange={(checked) => setBubblesEnabled(checked === true)}
              />
              <FieldLabel htmlFor={BUBBLE_TOGGLE_ID}>Bolhas por votos em jogo</FieldLabel>
            </Field>
            {showBubbles ? (
              largestBubbleValue > 0 ? (
                <MapBubbleKey largestValue={largestBubbleValue} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem projeção de votos válidos para os municípios do seu escopo.
                </p>
              )
            ) : null}
          </div>
        ) : null}

        {comparison && year === 2026 ? (
          <p className="text-sm text-muted-foreground">
            A comparação usa os anos com dados TSE (2014, 2018, 2022). Escolha um destes anos para
            ver o mapa comparativo.
          </p>
        ) : null}

        <MunicipalityMapSelection
          displayValues={displayValues}
          rawValues={rawValues}
          displayMax={displayMax}
          fillByKey={fillByKey}
          bubbleValues={bubbleValues}
          bubbleFillByKey={bubbleFillByKey}
          scopedKeys={scopedKeys}
          metricLabel={metricLabel}
          scaleMode={effectiveScaleMode}
          relativeReadingFor={relativeReadingFor}
          bubbleReadingFor={bubbleReadingFor}
          comparisonActive={comparisonActive}
          municipalitiesByMapKey={bundle.municipalitiesByMapKey}
          ariaLabel={
            comparisonActive && comparison
              ? `Mapa comparativo entre ${bundle.candidateName} e ${comparison.candidateName} por município`
              : `Mapa da Bahia com ${metricLabel} por município`
          }
        />

        {/* B8+ F3 — tied to the MESH: the comparison mode paints Salvador from
            the same approximate polygons, so the caveat has to survive with or
            without comparison. */}
        {bundle.hasZoneMunicipalities ? (
          <p className="text-sm text-muted-foreground">
            Salvador é pintada zona por zona. O desenho vem dos bairros de cada circunscrição
            (TRE-BA, RA nº 2/2017) sobre a malha do IBGE — é aproximado, não é o limite oficial do
            TSE.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Selection/hover live here so a mouseover re-renders only the map and the
 * readout — not the whole panel (controls, legend). The Leaflet paint path
 * itself stays ref-based inside BahiaMap (O(2) restyle).
 */
const MunicipalityMapSelection = ({
  displayValues,
  rawValues,
  displayMax,
  fillByKey,
  bubbleValues,
  bubbleFillByKey,
  scopedKeys,
  metricLabel,
  scaleMode,
  relativeReadingFor,
  bubbleReadingFor,
  comparisonActive,
  municipalitiesByMapKey,
  ariaLabel,
}: {
  displayValues: ChoroplethValues
  rawValues: ChoroplethValues
  displayMax: number
  fillByKey: ChoroplethFills | undefined
  bubbleValues: ChoroplethValues | undefined
  bubbleFillByKey: ChoroplethFills | undefined
  scopedKeys: string[]
  metricLabel: string
  scaleMode: MunicipalityMapScaleMode
  relativeReadingFor: (key: string) => string | null
  bubbleReadingFor: (key: string) => string | null
  comparisonActive: boolean
  municipalitiesByMapKey: MunicipalityMapBundle['municipalitiesByMapKey']
  ariaLabel: string
}) => {
  const router = useRouter()
  const [selectedFeature, setSelectedFeature] = useState<BahiaMapFeatureInfo | null>(null)
  const selectedKeyRef = useRef<string | null>(null)

  const handleFeatureSelect = useCallback((info: BahiaMapFeatureInfo | null) => {
    selectedKeyRef.current = info?.key ?? null
    setSelectedFeature(info)
  }, [])

  const handleFeatureActivate = useCallback(
    (key: string) => {
      if (selectedKeyRef.current !== key) return

      // Annotated because `noUncheckedIndexedAccess` is off: the index is
      // genuinely partial — a painted key outside the actor's scope has no slug.
      const slug: string | undefined = municipalitiesByMapKey[key]
      if (slug) router.push(`/campanha/municipios/${slug}`)
    },
    [municipalitiesByMapKey, router],
  )

  const selectedMetricValue =
    selectedFeature && selectedFeature.key in displayValues
      ? displayValues[selectedFeature.key]
      : undefined

  const selectedRawMetricValue =
    selectedFeature && selectedFeature.key in rawValues ? rawValues[selectedFeature.key] : undefined

  const selectedSlug: string | undefined = selectedFeature
    ? municipalitiesByMapKey[selectedFeature.key]
    : undefined

  return (
    <>
      <BahiaMap
        mode="municipality"
        values={displayValues}
        scaleMax={displayMax > 0 ? displayMax : undefined}
        fillByKey={fillByKey}
        bubbleValues={bubbleValues}
        bubbleFillByKey={bubbleFillByKey}
        fillMode={comparisonActive ? 'diverging' : 'sequential'}
        fitToKeys={scopedKeys}
        interactiveKeys={scopedKeys}
        selectedKey={selectedFeature?.key ?? null}
        onFeatureSelect={handleFeatureSelect}
        onFeatureActivate={handleFeatureActivate}
        ariaLabel={ariaLabel}
      />

      <MapFeatureReadout
        feature={selectedFeature}
        metricValue={selectedMetricValue}
        rawMetricValue={selectedRawMetricValue}
        metricLabel={metricLabel}
        scaleMode={scaleMode}
        relativeReading={selectedFeature ? relativeReadingFor(selectedFeature.key) : null}
        bubbleReading={selectedFeature ? bubbleReadingFor(selectedFeature.key) : null}
        comparisonActive={comparisonActive}
        municipalitySlug={selectedSlug}
      />
    </>
  )
}
