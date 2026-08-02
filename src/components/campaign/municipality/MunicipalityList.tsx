import { SearchXIcon } from 'lucide-react'
import Link from 'next/link'

import {
  advisorEntriesFromIds,
  formatAdvisorNamesTooltip,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListGoalCoverageCell } from '@/components/campaign/municipality/MunicipalityListGoalCoverageCell'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { MunicipalityListMobileSection } from '@/components/campaign/municipality/MunicipalityListMobileSection'
import {
  SignalAgeReadout,
  TerritorialClassReadout,
} from '@/components/campaign/municipality/MunicipalityListRowReadouts'
import { MunicipalityListSignalControl } from '@/components/campaign/municipality/MunicipalityListSignalControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { MunicipalitySortableHead } from '@/components/campaign/municipality/MunicipalitySortableHead'
import { MunicipalityVotePositionReadout } from '@/components/campaign/municipality/MunicipalityVotePositionReadout'
import { TerritoryLink } from '@/components/campaign/municipality/TerritoryLink'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import {
  resolveVisibleColumns,
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import { formatEngagementLevelLabel } from '@/lib/engagementLevel'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatTerritorialClassWhy,
  municipalityColumnDescriptions,
  type MunicipalityListColumnId,
} from '@/utilities/municipality/municipalityLabels'
import {
  clearMunicipalityListFilters,
  type MunicipalityFilterOption,
} from '@/utilities/municipality/municipalityListFilters'
import {
  buildMunicipalityListHref,
  formatMunicipalityListSortSummary,
  municipalityColumnLabels,
  resolveMunicipalityListSort,
  type MunicipalityListState,
} from '@/utilities/municipality/municipalityListUrl'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'
import { toMunicipalityPledgeCoverageView } from '@/utilities/votePledgeViews'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type MunicipalityStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

type MunicipalityColumnFilterOptions = {
  /** Bare catalog slugs — labeled on the client (B16+ payload trim). */
  name: readonly string[]
  region: MunicipalityFilterOption[]
  advisor: MunicipalityFilterOption[]
}

export type MunicipalityListProps = {
  municipalities: MunicipalityListViewModel[]
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  isStaffView: boolean
  isCoordinator: boolean
  /**
   * E14 — moving the ladder is unrestricted staff (coordinator + candidate),
   * a wider set than `isCoordinator`, so it travels as its own prop instead of
   * quietly hiding the control from the candidate.
   */
  canMoveEngagementLevel: boolean
  advisorOptions: EligibleAdvisorOption[]
  columnFilterOptions: MunicipalityColumnFilterOptions
  signalFormAction: MunicipalityStaffFormAction
  state: MunicipalityListState
  columnVisibility: CampaignColumnVisibility
}

/** Replaces only the rows: the filter header row stays put. */
const MunicipalityListEmptyState = ({ state }: { state: MunicipalityListState }) => (
  <Empty className="min-h-56">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>Nenhum município encontrado</EmptyTitle>
      <EmptyDescription>
        Ajuste a busca ou os filtros. Você só vê municípios dentro do seu escopo.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      {/* Same contract as the filter bar's Limpar: drop filters, keep the sort. */}
      <CampaignTransitionAnchor
        href={buildMunicipalityListHref(clearMunicipalityListFilters(state), 1)}
        replace
        scroll={false}
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
      >
        Limpar busca e filtros
      </CampaignTransitionAnchor>
    </EmptyContent>
  </Empty>
)

const advisorEntries = (
  municipality: MunicipalityListViewModel,
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>,
) => advisorEntriesFromIds(municipality.advisorIDs, advisorNamesById)

/**
 * Desktop table columns (Pass 2 W1). `id` is the picker key, cookie key, and B22
 * description key — typed instead of widening to `string`.
 */
type MunicipalityColumn = CampaignTableColumn<MunicipalityListViewModel> & {
  id: MunicipalityListColumnId
}

const municipalityListColumns = ({
  state,
  isStaffView,
  isCoordinator,
  canMoveEngagementLevel,
  columnFilterOptions,
  advisorNamesById,
  advisorOptions,
  signalFormAction,
}: MunicipalityListProps): Array<MunicipalityColumn> => [
  {
    id: 'name',
    label: municipalityColumnLabels.name,
    mandatory: true,
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="name"
        filterParam="name"
        filterOptions={columnFilterOptions.name}
        showPriorityFilter={isStaffView}
        description={municipalityColumnDescriptions.name}
        className="sticky left-0 z-20 min-w-56 bg-background"
      />
    ),
    cellClassName: 'sticky left-0 z-[5] min-w-56 whitespace-normal bg-background',
    cell: (municipality) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/campanha/municipios/${municipality.slug}`}
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          {municipality.name}
        </Link>
        {municipality.priority === 'alta' && isStaffView ? <MunicipalityPriorityIndicator /> : null}
      </div>
    ),
  },
  {
    id: 'region',
    label: municipalityColumnLabels.region,
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="region"
        filterParam="region"
        filterOptions={columnFilterOptions.region}
        description={municipalityColumnDescriptions.region}
      />
    ),
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (municipality) => <TerritoryLink region={municipality.region} />,
  },
  {
    id: 'votos',
    label: municipalityColumnLabels.votos,
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="votos"
        align="right"
        description={municipalityColumnDescriptions.votos}
      />
    ),
    cellClassName: 'text-right',
    cell: (municipality) =>
      municipality.votePosition2022 ? (
        <MunicipalityVotePositionReadout position={municipality.votePosition2022} layout="table" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  ...(isStaffView
    ? ([
        {
          // Sits right after "2022": both read the same TSE artifact, and the
          // class is the one-word summary of the votes beside it.
          id: 'classe',
          label: municipalityColumnLabels.classe,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="classe"
              filterParam="class"
              description={municipalityColumnDescriptions.classe}
            />
          ),
          cell: (municipality) => <TerritorialClassReadout municipality={municipality} />,
          // The factors behind the label — the cell keeps them as `sr-only`
          // text, so this stays a redundant affordance (see `cellTooltip`).
          cellTooltip: (municipality) =>
            municipality.territorialClass === 'sem_base'
              ? null
              : formatTerritorialClassWhy(municipality.territorialClassFactors),
        },
        {
          // Right after "Classe": the pair reads diagnosis then decision.
          id: 'level',
          label: municipalityColumnLabels.level,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="nivel"
              filterParam="level"
              description={municipalityColumnDescriptions.level}
            />
          ),
          cell: (municipality) =>
            canMoveEngagementLevel ? (
              <MunicipalityListLevelControl
                municipalityID={municipality.id}
                municipalityName={municipality.name}
                level={municipality.engagementLevel}
                levelNote={municipality.levelNote}
                levelChangedAt={municipality.levelChangedAt}
                variant="popover"
              />
            ) : (
              <MunicipalityLevelBadge
                level={municipality.engagementLevel}
                note={municipality.levelNote}
                layout="table"
              />
            ),
          // The editable cell wraps its own trigger in a tooltip; declaring it
          // here too would double it up on the same gesture (as in `advisors`).
          cellTooltip: (municipality) =>
            canMoveEngagementLevel || !municipality.engagementLevel
              ? null
              : [formatEngagementLevelLabel(municipality.engagementLevel), municipality.levelNote]
                  .filter(Boolean)
                  .join(' — '),
        },
        {
          id: 'advisors',
          label: municipalityColumnLabels.advisors,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="coverage"
              filterParam="advisor"
              filterOptions={columnFilterOptions.advisor}
              description={municipalityColumnDescriptions.advisors}
            />
          ),
          cell: (municipality) =>
            isCoordinator ? (
              <MunicipalityListAdvisorsControl
                municipalityID={municipality.id}
                municipalityName={municipality.name}
                currentAdvisorIDs={municipality.advisorIDs}
                isPriority={municipality.priority === 'alta'}
                advisorNamesById={advisorNamesById}
                options={advisorOptions}
                variant="popover"
              />
            ) : (
              <MunicipalityAdvisorAvatarStack
                advisors={advisorEntries(municipality, advisorNamesById)}
                isPriority={municipality.priority === 'alta'}
              />
            ),
          // The coordinator's cell already wraps its own Popover trigger in a
          // tooltip (see `MunicipalityListAdvisorsControl`) — declaring it
          // here too would double it up on the same gesture.
          cellTooltip: (municipality) =>
            isCoordinator
              ? null
              : formatAdvisorNamesTooltip(advisorEntries(municipality, advisorNamesById)),
        },
        {
          id: 'trend',
          label: municipalityColumnLabels.trend,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="trend"
              filterParam="trend"
              description={municipalityColumnDescriptions.trend}
            />
          ),
          cell: (municipality) => (
            <MunicipalityListTrendControl
              municipalityID={municipality.id}
              municipalityName={municipality.name}
              status={municipality.politicalTrendStatus}
              trendNote={municipality.politicalTrendNote}
              variant="popover"
            />
          ),
        },
        {
          id: 'expectedVotes',
          label: municipalityColumnLabels.expectedVotes,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="expectedVotes"
              align="center"
              description={municipalityColumnDescriptions.expectedVotes}
            />
          ),
          cellClassName: 'relative overflow-visible align-middle text-center',
          cell: (municipality) => (
            <div className="flex min-h-11 items-center justify-center">
              <MunicipalityListExpectedVotesControl
                municipalityID={municipality.id}
                municipalityName={municipality.name}
                expectedVotes={municipality.expectedVotes}
                pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                variant="popover"
              />
            </div>
          ),
        },
        {
          id: 'lastSignal',
          label: municipalityColumnLabels.lastSignal,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="frescor"
              description={municipalityColumnDescriptions.lastSignal}
            >
              {/* The one header that does NOT inherit its sort label: the column
                  shows the signal, `frescor` sorts by how old it is. */}
              {municipalityColumnLabels.lastSignal}
            </MunicipalitySortableHead>
          ),
          cell: (municipality) => (
            <MunicipalityListSignalControl
              municipalityID={municipality.id}
              municipalitySlug={municipality.slug}
              municipalityName={municipality.name}
              lastSignalAt={municipality.lastSignalAt}
              variant="popover"
              formAction={signalFormAction}
            >
              <SignalAgeReadout lastSignalAt={municipality.lastSignalAt} layout="table" />
            </MunicipalityListSignalControl>
          ),
        },
        {
          id: 'goalCoverage',
          label: municipalityColumnLabels.goalCoverage,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="deficit"
              description={municipalityColumnDescriptions.goalCoverage}
            />
          ),
          cell: (municipality) => (
            <MunicipalityListGoalCoverageCell
              coverageByScenario={municipality.goalCoverageByScenario}
            />
          ),
        },
      ] satisfies Array<MunicipalityColumn>)
    : ([
        {
          id: 'lastUpdateAt',
          label: municipalityColumnLabels.lastUpdateAt,
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="lastUpdateAt"
              description={municipalityColumnDescriptions.lastUpdateAt}
            />
          ),
          cell: (municipality) =>
            municipality.lastUpdateAt
              ? dateFormatter.format(new Date(municipality.lastUpdateAt))
              : 'Sem atualização',
        },
      ] satisfies Array<MunicipalityColumn>)),
]

export const MunicipalityList = (props: MunicipalityListProps) => {
  const { municipalities, advisorNamesById, isStaffView, isCoordinator, advisorOptions, state } =
    props
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const sortSummary = formatMunicipalityListSortSummary(activeSort, activeDir)
  const columns = municipalityListColumns(props)
  // Asks the same function the table asks, so a column that becomes
  // `mandatory` cannot be on screen while the caption denies it.
  const showsVoteColumn = resolveVisibleColumns(
    columns,
    props.columnVisibility.hiddenColumnIds,
  ).some((column) => column.id === 'votos')

  return (
    <>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {sortSummary}
      </p>

      <MunicipalityListMobileSection
        municipalities={municipalities}
        advisorNamesById={advisorNamesById}
        isStaffView={isStaffView}
        isCoordinator={isCoordinator}
        canMoveEngagementLevel={props.canMoveEngagementLevel}
        advisorOptions={advisorOptions}
        signalFormAction={props.signalFormAction}
        emptySlot={<MunicipalityListEmptyState state={state} />}
      />

      {/* A sticky <th> can't paint the row border, hence the inset shadow. */}
      <CampaignTable
        className="hidden overflow-visible md:block"
        containerClassName="overflow-x-auto"
        headerClassName="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl [&_tr]:border-b-0"
        caption={
          <>
            {sortSummary}
            {showsVoteColumn ? `. Coluna 2022: ${municipalityColumnDescriptions.votos}` : null}
          </>
        }
        columns={columns}
        columnVisibility={props.columnVisibility}
        rows={municipalities}
        rowKey={(municipality) => municipality.id}
        empty={<MunicipalityListEmptyState state={state} />}
      />
    </>
  )
}
