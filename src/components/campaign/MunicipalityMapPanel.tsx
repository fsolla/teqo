'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useRef, useState, useTransition } from 'react'

import { BahiaMap, type BahiaMapFeatureInfo } from '@/components/campaign/BahiaMap'
import { ChoroplethLegend } from '@/components/campaign/ChoroplethLegend'
import { MapFeatureReadout } from '@/components/campaign/MapFeatureReadout'
import { useMunicipalityEstimateScenarioOptional } from '@/components/campaign/MunicipalityEstimateScenarioContext'
import {
  VOTE_ESTIMATE_SCENARIO_MAP_HINT,
  VoteEstimateScenarioField,
} from '@/components/campaign/VoteEstimateScenarioField'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { computeChoroplethMax } from '@/lib/bahiaMapStyle'
import { computeValidVoteShares, divergingGradientCss } from '@/lib/choroplethColorScale'
import { formatElectionNumber } from '@/lib/electionInsights'
import type { FederalCandidateOption } from '@/utilities/electionCandidateOptions'
import {
  MUNICIPALITY_MAP_SCALE_MODES,
  MUNICIPALITY_MAP_YEARS,
  municipalityMapScaleModeLabels,
  municipalityMapYearLabels,
  type MunicipalityMapBundle,
  type MunicipalityMapScaleMode,
  type MunicipalityMapYear,
} from '@/utilities/municipalityMapContract'
import { resolveMunicipalityMapNavigation } from '@/utilities/municipalityMapNavigation'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'

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
  const [scaleMode, setScaleMode] = useState<MunicipalityMapScaleMode>('percentValid')
  const scenarioContext = useMunicipalityEstimateScenarioOptional()
  const [localEstimateScenario, setLocalEstimateScenario] = useState<VoteEstimateScenario>(
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )
  const estimateScenario = scenarioContext?.scenario ?? localEstimateScenario
  const setEstimateScenario = scenarioContext?.setScenario ?? setLocalEstimateScenario

  const comparison = bundle.comparison
  const comparisonActive = comparison !== null && year !== 2026
  const percentScaleActive = !comparisonActive && scaleMode === 'percentValid'

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
    () => Object.keys(bundle.municipalitiesByIbgeCode),
    [bundle.municipalitiesByIbgeCode],
  )

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
            Mapa das Praças
          </h2>
          <p className="text-sm text-muted-foreground">
            {comparisonActive && comparison
              ? `Comparação ${bundle.candidateName} × ${comparison.candidateName} em ${year}.`
              : percentScaleActive
                ? `Cor pela participação nos votos válidos — em 2026, estimativas sobre válidos de 2022.`
                : `Cor pela votação de ${bundle.candidateName} — em 2026, pelas estimativas da campanha.`}
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
            <Field className="w-full sm:w-44">
              <FieldLabel htmlFor="municipality-map-scale">Escala</FieldLabel>
              <NativeSelect
                id="municipality-map-scale"
                value={scaleMode}
                onChange={(event) => setScaleMode(event.target.value as MunicipalityMapScaleMode)}
                className="min-h-11 w-full"
              >
                {MUNICIPALITY_MAP_SCALE_MODES.map((mode) => (
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
        ) : displayMax > 0 ? (
          <ChoroplethLegend
            max={displayMax}
            metricLabel={metricLabel}
            formatMax={percentScaleActive ? () => '100%' : undefined}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sem dados para este ano no seu escopo.</p>
        )}

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
          scopedKeys={scopedKeys}
          metricLabel={metricLabel}
          scaleMode={comparisonActive ? 'absolute' : scaleMode}
          comparisonActive={comparisonActive}
          municipalitiesByIbgeCode={bundle.municipalitiesByIbgeCode}
          ariaLabel={
            comparisonActive && comparison
              ? `Mapa comparativo entre ${bundle.candidateName} e ${comparison.candidateName} por município`
              : `Mapa da Bahia com ${metricLabel} por município`
          }
        />

        {/* zone breakdown below */}
        {bundle.zoneBreakdown.length > 0 && !comparisonActive ? (
          <div id="municipality-zone-breakdown" className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Praças por zona eleitoral</h3>
            <p className="text-sm text-muted-foreground">
              Zonas não têm polígono oficial — Salvador e Camaçari aparecem agregadas no mapa e
              detalhadas aqui.
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {bundle.zoneBreakdown.map((zone) => (
                <li
                  key={zone.slug}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <Link
                    href={`/campanha/municipios/${zone.slug}`}
                    className="min-h-11 content-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {zone.name}
                  </Link>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatElectionNumber(
                      year === 2026
                        ? (zone.votes2026ByScenario[estimateScenario] ?? 0)
                        : (zone.votesByYear[String(year)] ?? 0),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Selection/hover live here so a mouseover re-renders only the map and the
 * readout — not the whole panel (controls, legend, zone list). The Leaflet
 * paint path itself stays ref-based inside BahiaMap (O(2) restyle).
 */
const MunicipalityMapSelection = ({
  displayValues,
  rawValues,
  displayMax,
  scopedKeys,
  metricLabel,
  scaleMode,
  comparisonActive,
  municipalitiesByIbgeCode,
  ariaLabel,
}: {
  displayValues: Record<string, number>
  rawValues: Record<string, number>
  displayMax: number
  scopedKeys: string[]
  metricLabel: string
  scaleMode: MunicipalityMapScaleMode
  comparisonActive: boolean
  municipalitiesByIbgeCode: MunicipalityMapBundle['municipalitiesByIbgeCode']
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

      const navigation = resolveMunicipalityMapNavigation(key, municipalitiesByIbgeCode)
      if (navigation.kind === 'navigate') {
        router.push(`/campanha/municipios/${navigation.slug}`)
        return
      }

      if (navigation.kind === 'zones') {
        document.getElementById('municipality-zone-breakdown')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    },
    [municipalitiesByIbgeCode, router],
  )

  const selectedMetricValue =
    selectedFeature && selectedFeature.key in displayValues
      ? displayValues[selectedFeature.key]
      : undefined

  const selectedRawMetricValue =
    selectedFeature && selectedFeature.key in rawValues ? rawValues[selectedFeature.key] : undefined

  const selectedNavigation = useMemo(
    () =>
      selectedFeature
        ? resolveMunicipalityMapNavigation(selectedFeature.key, municipalitiesByIbgeCode)
        : null,
    [municipalitiesByIbgeCode, selectedFeature],
  )

  return (
    <>
      <BahiaMap
        mode="municipality"
        values={displayValues}
        scaleMax={displayMax > 0 ? displayMax : undefined}
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
        comparisonActive={comparisonActive}
        navigation={selectedNavigation}
      />
    </>
  )
}
