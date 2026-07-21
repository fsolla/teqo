'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { BahiaMap } from '@/components/campaign/BahiaMap'
import { ChoroplethLegend } from '@/components/campaign/ChoroplethLegend'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  choroplethMaxAbsValue,
  choroplethMaxValue,
  divergingGradientCss,
} from '@/lib/choroplethColorScale'
import type { FederalCandidateOption } from '@/utilities/electionCandidateOptions'
import {
  PLAZA_MAP_YEARS,
  plazaMapYearLabels,
  type PlazaMapBundle,
  type PlazaMapYear,
} from '@/utilities/plazaMapData'

const voteFormatter = new Intl.NumberFormat('pt-BR')

type PlazaMapPanelProps = {
  bundle: PlazaMapBundle
  candidateOptions: FederalCandidateOption[]
  defaultYear?: PlazaMapYear
}

export const PlazaMapPanel = ({
  bundle,
  candidateOptions,
  defaultYear = 2022,
}: PlazaMapPanelProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [year, setYear] = useState<PlazaMapYear>(defaultYear)

  const comparison = bundle.comparison
  const comparisonActive = comparison !== null && year !== 2026

  const values = useMemo(() => {
    if (comparisonActive && comparison) {
      return comparison.diffByYear[String(year)] ?? {}
    }
    return bundle.valuesByYear[String(year)] ?? {}
  }, [bundle, comparison, comparisonActive, year])

  const max = comparisonActive ? choroplethMaxAbsValue(values) : choroplethMaxValue(values)
  const metricLabel =
    year === 2026 ? 'votos estimados 2026' : `votos de ${bundle.candidateName} em ${year}`

  const setCompare = (candidateNumber: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (candidateNumber) params.set('compare', candidateNumber)
    else params.delete('compare')
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  return (
    <section
      aria-labelledby="plaza-map-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="plaza-map-title" className="text-base font-medium">
            Mapa das Praças
          </h2>
          <p className="text-sm text-muted-foreground">
            {comparisonActive && comparison
              ? `Comparação ${bundle.candidateName} × ${comparison.candidateName} em ${year}.`
              : `Cor pela votação de ${bundle.candidateName} — em 2026, pelas estimativas da campanha.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor="plaza-map-year">Ano</FieldLabel>
            <NativeSelect
              id="plaza-map-year"
              value={String(year)}
              onChange={(event) => setYear(Number(event.target.value) as PlazaMapYear)}
              className="min-h-11 w-full"
            >
              {PLAZA_MAP_YEARS.map((entry) => (
                <NativeSelectOption key={entry} value={String(entry)}>
                  {plazaMapYearLabels[entry]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="w-full sm:w-72">
            <FieldLabel htmlFor="plaza-map-compare">Comparar com</FieldLabel>
            <NativeSelect
              id="plaza-map-compare"
              value={comparison ? String(comparison.candidateNumber) : ''}
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
            <span className="shrink-0 text-xs text-muted-foreground">+{bundle.candidateName}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vermelho: {bundle.candidateName} na frente · Branco: empate · Azul:{' '}
            {comparison.candidateName} na frente.
          </p>
        </div>
      ) : max > 0 ? (
        <ChoroplethLegend max={max} metricLabel={metricLabel} />
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados para este ano no seu escopo.</p>
      )}

      {comparison && year === 2026 ? (
        <p className="text-sm text-muted-foreground">
          A comparação usa os anos com dados TSE (2014, 2018, 2022). Escolha um destes anos para ver
          o mapa comparativo.
        </p>
      ) : null}

      <BahiaMap
        mode="municipality"
        values={values}
        fillMode={comparisonActive ? 'diverging' : 'sequential'}
        ariaLabel={
          comparisonActive && comparison
            ? `Mapa comparativo entre ${bundle.candidateName} e ${comparison.candidateName} por município`
            : `Mapa da Bahia com ${metricLabel} por município`
        }
      />

      {bundle.zoneBreakdown.length > 0 && !comparisonActive ? (
        <div className="flex flex-col gap-2">
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
                  href={`/campanha/pracas/${zone.slug}`}
                  className="min-h-11 content-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {zone.name}
                </Link>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {voteFormatter.format(zone.votesByYear[String(year)] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
