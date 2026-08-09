import Link from 'next/link'
import type { ReactElement } from 'react'

import { TerritorySortableHead } from '@/components/campaign/municipality/TerritorySortableHead'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import {
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import type { MunicipalityRelationEntry } from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import { MunicipalityRelationAvatarStack } from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import { VoteEstimateScenarioStrip } from '@/components/campaign/votePledge/VoteEstimateScenarioStrip'
import { Badge } from '@/components/ui/Badge'
import { formatElectionNumber, formatVoteSharePercent } from '@/lib/electionFormat'
import { stateDeputyDisplayName } from '@/lib/stateDeputyNameParty'
import { formatVoteEstimateScenarioAriaLabel } from '@/lib/voteEstimate'
import {
  formatGoalCoverageDeficitShortLabel,
  formatGoalCoverageRatioLabel,
  formatRatioAsPercentLabel,
} from '@/utilities/municipality/goalCoverage'
import {
  formatTerritorialClassWhy,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipality/municipalityLabels'
import type {
  TerritoryNetworkReferences,
  TerritoryStateDeputyReference,
} from '@/utilities/territory/loadTerritoryOverview'
import type { TerritoryFilterOption } from '@/utilities/territory/territoryListFilters'
import { territoryColumnDescriptions } from '@/utilities/territory/territoryListLabels'
import {
  territoryListSortLabels,
  type TerritoryListState,
} from '@/utilities/territory/territoryListUrl'
import type { TerritoryTableRow } from '@/utilities/territory/territoryOverview'

const CoverageCell = ({
  withAdvisorCount,
  total,
  muted,
}: {
  withAdvisorCount: number
  total: number
  muted: boolean
}) => {
  if (total === 0) return <span className="text-muted-foreground">—</span>
  if (withAdvisorCount === 0) {
    return <Badge variant="estimate-pending">0 de {total}</Badge>
  }
  return (
    <span className={muted ? 'tabular-nums text-muted-foreground' : 'tabular-nums'}>
      {withAdvisorCount} de {total}
    </span>
  )
}

const TerritorialClassCell = ({ row }: { row: TerritoryTableRow }) => {
  const territorialClass = row.territorialClass
  if (!territorialClass) {
    return <span className="text-muted-foreground">—</span>
  }
  const why = formatTerritorialClassWhy(territorialClass.factors)
  if (territorialClass.class === 'sem_base') {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{why}</span>
      </span>
    )
  }
  return (
    <>
      <Badge variant={territorialClassBadgeVariant[territorialClass.class]}>
        {territorialClassLabels[territorialClass.class]}
      </Badge>
      <span className="sr-only">{why}</span>
    </>
  )
}

const captureTooltipContent = (row: TerritoryTableRow) => {
  const parts: string[] = []
  if (row.medianCapture != null) {
    parts.push(`Mediana no território: ${formatRatioAsPercentLabel(row.medianCapture)}`)
  }
  if (row.captureMin != null && row.captureMax != null) {
    parts.push(
      `Amplitude: ${formatRatioAsPercentLabel(row.captureMin)} – ${formatRatioAsPercentLabel(row.captureMax)}`,
    )
  }
  if (row.criticalMunicipality && row.criticalMunicipality.deficit > 0) {
    parts.push(
      `Município crítico (maior déficit de meta): ${row.criticalMunicipality.name} (faltam ${formatElectionNumber(row.criticalMunicipality.deficit)} votos)`,
    )
  }
  if (row.captureBeacon) {
    parts.push(
      `Referência de captura no território: ${row.captureBeacon.name} (${formatRatioAsPercentLabel(row.captureBeacon.captureRate)})`,
    )
  }
  if (parts.length === 0) {
    return 'Sem dados de captura 2022 neste recorte.'
  }
  return (
    <div className="flex flex-col gap-1">
      {parts.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {row.criticalMunicipality && row.criticalMunicipality.deficit > 0 ? (
        <Link
          href={`/campanha/municipios/${row.criticalMunicipality.slug}`}
          className="font-medium underline underline-offset-2"
        >
          Abrir município crítico
        </Link>
      ) : null}
      <p className="text-background/70">
        A captura do território é a soma dos votos próprios ÷ soma dos tetos — não a média das
        capturas por município.
      </p>
    </div>
  )
}

/** B175 — 2022 cell mirroring the municípios pattern: % first, votes as the meta line. */
const TerritoryVoteReadout = ({ row }: { row: TerritoryTableRow }) => {
  const votes = row.votesByYear['2022'] ?? 0
  const share = row.pctPropriaVotacao
  return (
    <div
      className="flex flex-col items-end gap-0.5 tabular-nums"
      aria-label={`${formatVoteSharePercent(share)} da votação estadual, ${formatElectionNumber(votes)} votos`}
    >
      <span className="font-medium">{formatVoteSharePercent(share)}</span>
      <span className="text-xs text-muted-foreground">{formatElectionNumber(votes)}</span>
      {/* The valid votes live only in the hover — keep them as sr-only text so the tooltip repeats, never invents. */}
      <span className="sr-only">
        Votos válidos de deputado federal em 2022 no território:{' '}
        {formatElectionNumber(row.validVotes2022)}
      </span>
    </div>
  )
}

/** B175 — 2026 read-only cell: central-scenario total + % as a secondary line; scenarios on hover. */
const TerritoryEstimateReadout = ({ row }: { row: TerritoryTableRow }) => {
  if (!row.hasEstimate) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className="font-medium">{formatElectionNumber(row.estimateByScenario.central)}</span>
      <span className="text-xs text-muted-foreground">
        {formatVoteSharePercent(row.pctPropriaVotacao)}
      </span>
      {/* Same redundancy contract as the cell's hover strip (municípios precedent). */}
      <span className="sr-only">{formatVoteEstimateScenarioAriaLabel(row.estimateByScenario)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// B175 — read-only network columns (Assessor / Liderança / Dobradinha)
// ---------------------------------------------------------------------------

const territoryNetworkColumnDescriptions = {
  advisor:
    'Assessores de staff atribuídos nos municípios do território. Nomes no detalhe da célula.',
  leadership: 'Lideranças vinculadas aos municípios do território. Nomes no detalhe da célula.',
  stateDeputy:
    'Deputados estaduais em dobradinha nos municípios do território. Nomes no detalhe da célula.',
} as const

const territoryNetworkColumnLabels = {
  advisor: 'Assessor',
  leadership: 'Liderança',
  stateDeputy: 'Dobradinha',
} as const

const advisorEntries = (
  row: TerritoryTableRow,
  advisorNamesById: TerritoryNetworkReferences['advisorNamesById'],
): MunicipalityRelationEntry[] =>
  row.advisorIDs.flatMap((id) => {
    const advisor = advisorNamesById.get(id)
    return advisor ? [{ id: advisor.id, label: advisor.name }] : []
  })

const leadershipEntries = (
  row: TerritoryTableRow,
  leadershipNamesById: TerritoryNetworkReferences['leadershipNamesById'],
): MunicipalityRelationEntry[] =>
  row.leadershipIDs.flatMap((id) => {
    const leadership = leadershipNamesById.get(id)
    return leadership
      ? [
          {
            id: leadership.id,
            label: leadership.name,
            href: `/campanha/liderancas/${leadership.id}`,
          },
        ]
      : []
  })

const stateDeputyEntries = (
  row: TerritoryTableRow,
  stateDeputyById: TerritoryNetworkReferences['stateDeputyById'],
): MunicipalityRelationEntry[] =>
  row.stateDeputyIDs.flatMap((id) => {
    const deputy: TerritoryStateDeputyReference | undefined = stateDeputyById.get(id)
    if (!deputy) return []
    return [
      {
        id: deputy.id,
        label: stateDeputyDisplayName(deputy.plainName, deputy.party),
        initialsLabel: deputy.plainName,
        href: deputy.href,
      },
    ]
  })

const namesTooltip = (entries: MunicipalityRelationEntry[]): ReactElement | null =>
  entries.length === 0 ? null : (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <span key={entry.id}>{entry.label}</span>
      ))}
    </div>
  )

const NetworkCell = ({ entries }: { entries: MunicipalityRelationEntry[] }) => (
  <MunicipalityRelationAvatarStack
    entries={entries}
    emptyState={<span className="text-muted-foreground">—</span>}
    maxVisible={3}
  />
)

/**
 * B175 — column widths keep the density ladder: P0 core is always on, one
 * column joins per panel-width rung, never a horizontal scrollbar.
 */
const responsiveColumnClassName = {
  captura: 'hidden @min-[44rem]/territory-list:table-cell',
  classe: 'hidden @min-[50rem]/territory-list:table-cell',
  coverage: 'hidden @min-[54rem]/territory-list:table-cell',
  advisor: 'hidden @min-[60rem]/territory-list:table-cell',
  leadership: 'hidden @min-[66rem]/territory-list:table-cell',
  stateDeputy: 'hidden @min-[72rem]/territory-list:table-cell',
  cobertura: 'hidden @min-[78rem]/territory-list:table-cell',
} as const

type TerritoryListColumnsProps = {
  state: TerritoryListState
  regionOptions: TerritoryFilterOption[]
  references: TerritoryNetworkReferences
}

export const territoryListColumns = ({
  state,
  regionOptions,
  references,
}: TerritoryListColumnsProps): Array<CampaignTableColumn<TerritoryTableRow>> => {
  const { advisorNamesById, leadershipNamesById, stateDeputyById } = references

  return [
    {
      id: 'region',
      mandatory: true,
      label: territoryListSortLabels.region,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="region"
          filterParam="region"
          filterOptions={regionOptions}
          description={territoryColumnDescriptions.region}
          className="sticky left-0 z-20 min-w-56 bg-background"
        />
      ),
      cell: (row) =>
        row.variant === 'parent' ? (
          <CampaignTransitionAnchor
            href={`/campanha/municipios?region=${encodeURIComponent(row.region)}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.region}{' '}
            <span className="text-muted-foreground tabular-nums">({row.municipalityCount})</span>
          </CampaignTransitionAnchor>
        ) : (
          // The Metropolitano sub-labels already carry a count group ("Salvador (19 zonas)"),
          // so the count rides the name only when the label has none — never stacking "(19 zonas) (19)".
          <span className="pl-4 text-muted-foreground">
            {row.label}{' '}
            {/\(\d[^)]*\)$/.test(row.label) ? null : (
              <span className="tabular-nums">({row.municipalityCount})</span>
            )}
          </span>
        ),
      cellClassName: (row) =>
        `sticky left-0 z-[5] min-w-56 ${row.variant === 'sub' ? 'bg-muted' : 'bg-background'}`,
    },
    {
      id: 'votes2022',
      label: territoryListSortLabels.votes2022,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="votes2022"
          align="right"
          description={territoryColumnDescriptions.votes2022}
        />
      ),
      cell: (row) => <TerritoryVoteReadout row={row} />,
      cellClassName: 'text-right tabular-nums',
      // The valid-votes figure is the cell's exclusive hover content (B175).
      cellTooltip: (row) =>
        `Votos válidos de deputado federal em 2022 no território: ${formatElectionNumber(row.validVotes2022)}`,
    },
    {
      id: 'captura',
      label: territoryListSortLabels.captura,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="captura"
          align="right"
          description={territoryColumnDescriptions.captura}
          className={responsiveColumnClassName.captura}
        />
      ),
      cell: (row) => formatRatioAsPercentLabel(row.captureRate),
      cellClassName: (row) =>
        `${responsiveColumnClassName.captura} text-right tabular-nums ${
          row.variant !== 'parent' ? 'text-muted-foreground' : ''
        }`,
      cellTooltip: (row) => captureTooltipContent(row),
    },
    {
      id: 'estimate2026',
      label: territoryListSortLabels.estimate2026,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="estimate2026"
          align="right"
          description={territoryColumnDescriptions.estimate2026}
        />
      ),
      cell: (row) => <TerritoryEstimateReadout row={row} />,
      cellClassName: (row) =>
        `text-right tabular-nums ${row.variant === 'sub' ? 'text-muted-foreground' : ''}`,
      cellTooltip: (row) =>
        row.hasEstimate ? (
          <div className="w-44">
            <VoteEstimateScenarioStrip
              values={row.estimateByScenario}
              labelMode="endpoints"
              markerMode="active-only"
            />
          </div>
        ) : null,
    },
    {
      id: 'advisor',
      label: territoryNetworkColumnLabels.advisor,
      head: (
        <CampaignTableHead
          description={territoryNetworkColumnDescriptions.advisor}
          className={responsiveColumnClassName.advisor}
        >
          {territoryNetworkColumnLabels.advisor}
        </CampaignTableHead>
      ),
      cellClassName: responsiveColumnClassName.advisor,
      cell: (row) => <NetworkCell entries={advisorEntries(row, advisorNamesById)} />,
      cellTooltip: (row) => namesTooltip(advisorEntries(row, advisorNamesById)),
    },
    {
      id: 'leadership',
      label: territoryNetworkColumnLabels.leadership,
      head: (
        <CampaignTableHead
          description={territoryNetworkColumnDescriptions.leadership}
          className={responsiveColumnClassName.leadership}
        >
          {territoryNetworkColumnLabels.leadership}
        </CampaignTableHead>
      ),
      cellClassName: responsiveColumnClassName.leadership,
      cell: (row) => <NetworkCell entries={leadershipEntries(row, leadershipNamesById)} />,
      cellTooltip: (row) => namesTooltip(leadershipEntries(row, leadershipNamesById)),
    },
    {
      id: 'stateDeputy',
      label: territoryNetworkColumnLabels.stateDeputy,
      head: (
        <CampaignTableHead
          description={territoryNetworkColumnDescriptions.stateDeputy}
          className={responsiveColumnClassName.stateDeputy}
        >
          {territoryNetworkColumnLabels.stateDeputy}
        </CampaignTableHead>
      ),
      cellClassName: responsiveColumnClassName.stateDeputy,
      cell: (row) => <NetworkCell entries={stateDeputyEntries(row, stateDeputyById)} />,
      cellTooltip: (row) => namesTooltip(stateDeputyEntries(row, stateDeputyById)),
    },
    {
      id: 'classe',
      label: territoryListSortLabels.classe,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="classe"
          align="right"
          description={territoryColumnDescriptions.classe}
          className={responsiveColumnClassName.classe}
        />
      ),
      cell: (row) => <TerritorialClassCell row={row} />,
      cellClassName: (row) =>
        `${responsiveColumnClassName.classe} text-right ${
          row.variant !== 'parent' ? 'text-muted-foreground' : ''
        }`,
      cellTooltip: (row) =>
        row.territorialClass ? formatTerritorialClassWhy(row.territorialClass.factors) : undefined,
    },
    {
      id: 'coverage',
      label: territoryListSortLabels.coverage,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="coverage"
          align="right"
          filterParam="coverage"
          description={territoryColumnDescriptions.coverage}
          className={responsiveColumnClassName.coverage}
        />
      ),
      cell: (row) => (
        <CoverageCell
          withAdvisorCount={row.withAdvisorCount}
          total={row.municipalityCount}
          muted={row.variant === 'sub'}
        />
      ),
      cellClassName: `${responsiveColumnClassName.coverage} text-right`,
    },
    {
      id: 'cobertura',
      label: territoryListSortLabels.cobertura,
      head: (
        <TerritorySortableHead
          state={state}
          sortKey="cobertura"
          align="right"
          description={territoryColumnDescriptions.cobertura}
          className={responsiveColumnClassName.cobertura}
        />
      ),
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span className="font-medium tabular-nums">
            {formatGoalCoverageRatioLabel(row.goalCoverage)}
          </span>
          <span
            className="text-xs text-muted-foreground tabular-nums"
            title="Déficit agregado (cenário média)"
          >
            {formatGoalCoverageDeficitShortLabel(row.goalCoverage)}
          </span>
        </div>
      ),
      cellClassName: `${responsiveColumnClassName.cobertura} text-right`,
    },
  ]
}

/** B17 — the picker list; `region` is mandatory, the rest follow the visual order. */
export const territoryListPickerColumns = () => [
  { id: 'region', label: territoryListSortLabels.region, mandatory: true },
  { id: 'votes2022', label: territoryListSortLabels.votes2022 },
  { id: 'captura', label: territoryListSortLabels.captura },
  { id: 'estimate2026', label: territoryListSortLabels.estimate2026 },
  { id: 'advisor', label: territoryNetworkColumnLabels.advisor },
  { id: 'leadership', label: territoryNetworkColumnLabels.leadership },
  { id: 'stateDeputy', label: territoryNetworkColumnLabels.stateDeputy },
  { id: 'classe', label: territoryListSortLabels.classe },
  { id: 'coverage', label: territoryListSortLabels.coverage },
  { id: 'cobertura', label: territoryListSortLabels.cobertura },
]
