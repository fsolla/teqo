import { ActivityIcon, CircleAlertIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'

import {
  advisorEntriesFromIds,
  formatAdvisorNamesTooltip,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityAdvisorCreateProvider } from '@/components/campaign/municipality/MunicipalityAdvisorCreateProvider'
import { MunicipalityLeadershipCreateProvider } from '@/components/campaign/municipality/MunicipalityLeadershipCreateProvider'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListGoalCoverageCell } from '@/components/campaign/municipality/MunicipalityListGoalCoverageCell'
import { MunicipalityListLeadershipsControl } from '@/components/campaign/municipality/MunicipalityListLeadershipsControl'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { MunicipalityListMobileSection } from '@/components/campaign/municipality/MunicipalityListMobileSection'
import {
  SignalAgeReadout,
  TerritorialClassReadout,
} from '@/components/campaign/municipality/MunicipalityListRowReadouts'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalityListUpdateControl } from '@/components/campaign/municipality/MunicipalityListUpdateControl'
import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { MunicipalitySortableHead } from '@/components/campaign/municipality/MunicipalitySortableHead'
import { MunicipalityVotePositionReadout } from '@/components/campaign/municipality/MunicipalityVotePositionReadout'
import { TerritoryLink } from '@/components/campaign/municipality/TerritoryLink'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import {
  MunicipalityStateDeputyRelationCell,
  type MunicipalityStateDeputyCreateAction,
} from '@/components/campaign/shared/MunicipalityStateDeputyRelationCell'
import { Badge } from '@/components/ui/Badge'
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
  type CampaignColumnPickerColumn,
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import { formatEngagementLevelLabel } from '@/lib/engagementLevel'
import { SALVADOR_CITY_AGGREGATE_LABEL } from '@/lib/salvadorCity'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
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
import {
  isMunicipalitySignalCold,
  municipalitySignalAgeInDays,
} from '@/utilities/municipality/municipalitySignal'
import type {
  EligibleAdvisorOption,
  EligibleLeadershipOption,
  MunicipalityAdvisorSummary,
  MunicipalityLeadershipSummary,
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
  /** B155 — contact-name lookup for the Lideranças column chips. */
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
  isStaffView: boolean
  isCoordinator: boolean
  /**
   * E14 — moving the ladder is unrestricted staff (coordinator + candidate),
   * a wider set than `isCoordinator`, so it travels as its own prop instead of
   * quietly hiding the control from the candidate.
   */
  canMoveEngagementLevel: boolean
  /** B157 — the Dobradinhas column is coordinator + candidate only (intention aceite). */
  isCampaignUnrestricted: boolean
  advisorOptions: EligibleAdvisorOption[]
  /** B155 — every leadership the actor may add, for the Lideranças popover. */
  leadershipOptions: EligibleLeadershipOption[]
  /** B157 — the dobradinha catalog: chips, tooltip and search all read it. */
  stateDeputyOptions: StateDeputyRelationOption[]
  stateDeputyCommitAction: MunicipalityStaffFormAction
  stateDeputyCreateAction: MunicipalityStateDeputyCreateAction
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
type MunicipalityTableColumnId = MunicipalityListColumnId | 'actions'

type MunicipalityColumn = CampaignTableColumn<MunicipalityListViewModel> & {
  id: MunicipalityTableColumnId
}

const responsiveColumnClassName = {
  advisors: 'hidden @min-[54rem]/municipality-list:table-cell',
  trend: 'hidden @min-[60rem]/municipality-list:table-cell',
  leaderships: 'hidden @min-[66rem]/municipality-list:table-cell',
  stateDeputies: 'hidden @min-[72rem]/municipality-list:table-cell',
  goalCoverage: 'hidden @min-[78rem]/municipality-list:table-cell',
} as const satisfies Partial<Record<MunicipalityTableColumnId, string>>

/** B172 — `actions` only exists below 60rem, while trend's own column is gone. */
const actionsWidthGateClass = '@min-[60rem]/municipality-list:hidden'

const MunicipalityListSignalTrigger = ({
  lastSignalAt,
  presentation,
}: {
  lastSignalAt: string | null
  presentation: 'compact' | 'adaptive'
}) => {
  const isCold = isMunicipalitySignalCold(municipalitySignalAgeInDays(lastSignalAt))
  const Icon = isCold ? CircleAlertIcon : ActivityIcon
  const compact = (
    <Icon
      className={cn(
        'size-4',
        isCold ? 'text-estimate-pending-foreground' : 'text-muted-foreground',
      )}
      aria-hidden="true"
    />
  )

  if (presentation === 'compact') return compact

  return (
    <>
      <span className="@min-[84rem]/municipality-list:hidden">{compact}</span>
      <span className="hidden @min-[84rem]/municipality-list:block">
        <SignalAgeReadout lastSignalAt={lastSignalAt} layout="table" />
      </span>
    </>
  )
}

const municipalityListColumns = ({
  state,
  isStaffView,
  isCoordinator,
  isCampaignUnrestricted,
  canMoveEngagementLevel,
  columnFilterOptions,
  advisorNamesById,
  advisorOptions,
  leadershipNamesById,
  leadershipOptions,
  stateDeputyOptions,
  stateDeputyCommitAction,
  stateDeputyCreateAction,
  signalFormAction,
  columnVisibility,
}: MunicipalityListProps): Array<MunicipalityColumn> => {
  const manuallyHidden = isStaffView ? new Set(columnVisibility.hiddenColumnIds) : new Set<string>()
  const trendIsHidden = manuallyHidden.has('trend')
  const signalIsHidden = manuallyHidden.has('lastSignal')
  // B172 — while the picker still shows trend, the `actions` column is gated
  // closed by the same 60rem breakpoint that hides trend's own column (one
  // visible editor per row per width); a manual hide pins the column open.
  const actionsAlwaysVisible = trendIsHidden || signalIsHidden

  const renderTrendControl = (
    municipality: MunicipalityListViewModel,
    triggerPresentation: 'compact' | 'adaptive',
  ) => (
    <MunicipalityListTrendControl
      municipalityID={municipality.id}
      municipalityName={municipality.name}
      status={municipality.politicalTrendStatus}
      trendNote={municipality.politicalTrendNote}
      variant="popover"
      triggerPresentation={triggerPresentation}
    />
  )

  const renderSignalControl = (
    municipality: MunicipalityListViewModel,
    triggerPresentation: 'compact' | 'adaptive',
  ) => (
    <MunicipalityListUpdateControl
      municipalityID={municipality.id}
      municipalitySlug={municipality.slug}
      municipalityName={municipality.name}
      lastSignalAt={municipality.lastSignalAt}
      variant="popover"
      formAction={signalFormAction}
      isStaff={isCampaignUnrestricted}
    >
      <MunicipalityListSignalTrigger
        lastSignalAt={municipality.lastSignalAt}
        presentation={triggerPresentation}
      />
    </MunicipalityListUpdateControl>
  )

  // B178 — the city row is read-only: every interactive cell renders its
  // value (or a dash) without a popover/overlay for a municipality that does
  // not exist in the database. The trend badge mirrors the control's own
  // null-status trigger ("Não registrada"), the class cell keeps its real
  // aggregate class and the goal-coverage cell its honest empty state.
  const cityDash = <span className="text-muted-foreground">—</span>

  const renderTrendCell = (
    municipality: MunicipalityListViewModel,
    triggerPresentation: 'compact' | 'adaptive',
  ) =>
    municipality.isCity ? (
      <Badge variant="outline">Não registrada</Badge>
    ) : (
      renderTrendControl(municipality, triggerPresentation)
    )

  const renderSignalCell = (
    municipality: MunicipalityListViewModel,
    triggerPresentation: 'compact' | 'adaptive',
  ) => (municipality.isCity ? cityDash : renderSignalControl(municipality, triggerPresentation))

  return [
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
          className="sticky left-0 z-20 w-52 max-w-52 whitespace-normal bg-background"
        />
      ),
      cellClassName: 'sticky left-0 z-[5] w-52 max-w-52 whitespace-normal bg-background',
      cell: (municipality) => (
        // B165 — the name+territory read as one block: the row's minimum height
        // lives on the cell, so a 1-line name keeps the other columns aligned
        // while the territory sits ~2px under the name with no forced box below.
        <div className="flex min-h-11 min-w-0 max-w-52 flex-col gap-0.5">
          <div className="flex min-w-0 items-start gap-1.5">
            <Link
              href={`/campanha/municipios/${municipality.slug}`}
              className="line-clamp-2 min-w-0 flex-1 pt-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              {municipality.name}
            </Link>
            {municipality.isCity ? (
              <span className="mt-[5px] shrink-0">
                <Badge variant="secondary">Cidade</Badge>
              </span>
            ) : municipality.priority === 'alta' && isStaffView ? (
              <span className="mt-[5px] shrink-0">
                <MunicipalityPriorityIndicator />
              </span>
            ) : null}
          </div>
          <span className="block truncate text-xs text-muted-foreground">
            {municipality.isCity ? (
              <>
                {SALVADOR_CITY_AGGREGATE_LABEL} · {municipality.region}
              </>
            ) : (
              <TerritoryLink region={municipality.region} compact />
            )}
          </span>
        </div>
      ),
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
          <MunicipalityVotePositionReadout
            position={municipality.votePosition2022}
            layout="table"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(isStaffView
      ? ([
          {
            id: 'expectedVotes',
            label: municipalityColumnLabels.expectedVotes,
            head: (
              <MunicipalitySortableHead
                state={state}
                sortKey="expectedVotes"
                align="center"
                description={municipalityColumnDescriptions.expectedVotes}
              >
                2026
              </MunicipalitySortableHead>
            ),
            cellClassName: 'relative overflow-visible align-middle text-center tabular-nums',
            cell: (municipality) => (
              <div className="flex min-h-11 items-center justify-center">
                {municipality.isCity ? (
                  cityDash
                ) : (
                  <MunicipalityListExpectedVotesControl
                    municipalityID={municipality.id}
                    municipalityName={municipality.name}
                    expectedVotes={municipality.expectedVotes}
                    pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                    variant="popover"
                  />
                )}
              </div>
            ),
          },
          {
            // The declared investment follows the 2026 estimate: diagnosis and
            // decision stay together before the derived territorial class.
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
              municipality.isCity ? (
                cityDash
              ) : canMoveEngagementLevel ? (
                <MunicipalityListLevelControl
                  municipalityID={municipality.id}
                  municipalityName={municipality.name}
                  level={municipality.engagementLevel}
                  levelNote={municipality.levelNote}
                  levelChangedAt={municipality.levelChangedAt}
                  variant="popover"
                />
              ) : municipality.engagementLevel ? (
                <MunicipalityLevelBadge
                  level={municipality.engagementLevel}
                  note={municipality.levelNote}
                  layout="table"
                />
              ) : (
                <span className="text-muted-foreground">—</span>
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
            id: 'advisors',
            label: municipalityColumnLabels.advisors,
            head: (
              <MunicipalitySortableHead
                state={state}
                sortKey="coverage"
                filterParam="advisor"
                filterOptions={columnFilterOptions.advisor}
                description={municipalityColumnDescriptions.advisors}
                className={responsiveColumnClassName.advisors}
              />
            ),
            cellClassName: responsiveColumnClassName.advisors,
            cell: (municipality) =>
              municipality.isCity ? (
                cityDash
              ) : isCoordinator ? (
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
                className={responsiveColumnClassName.trend}
              />
            ),
            cellClassName: responsiveColumnClassName.trend,
            cell: (municipality) => renderTrendCell(municipality, 'adaptive'),
          },
          {
            id: 'leaderships',
            label: municipalityColumnLabels.leaderships,
            head: (
              <CampaignTableHead
                description={municipalityColumnDescriptions.leaderships}
                className={responsiveColumnClassName.leaderships}
              >
                {municipalityColumnLabels.leaderships}
              </CampaignTableHead>
            ),
            cellClassName: responsiveColumnClassName.leaderships,
            cell: (municipality) =>
              municipality.isCity ? (
                cityDash
              ) : (
                <MunicipalityListLeadershipsControl
                  municipalityID={municipality.id}
                  municipalityName={municipality.name}
                  currentLeadershipIDs={municipality.leadershipIDs}
                  leadershipNamesById={leadershipNamesById}
                  options={leadershipOptions}
                  variant="popover"
                />
              ),
          },
          {
            // B176 — staff-wide since 2026-08-09: the edit is scoped to the
            // actor's administered municípios server-side (B37/B157), so the
            // advisor gets the same inline control the Lideranças column has.
            id: 'stateDeputies',
            label: municipalityColumnLabels.stateDeputies,
            head: (
              <CampaignTableHead
                description={municipalityColumnDescriptions.stateDeputies}
                className={responsiveColumnClassName.stateDeputies}
              >
                {municipalityColumnLabels.stateDeputies}
              </CampaignTableHead>
            ),
            cellClassName: cn(
              responsiveColumnClassName.stateDeputies,
              'max-w-56 whitespace-normal',
            ),
            cell: (municipality) =>
              municipality.isCity ? (
                cityDash
              ) : (
                <MunicipalityStateDeputyRelationCell
                  municipalityId={municipality.id}
                  municipalityName={municipality.name}
                  stateDeputyIDs={municipality.stateDeputyIDs}
                  options={stateDeputyOptions}
                  commitAction={stateDeputyCommitAction}
                  createAction={stateDeputyCreateAction}
                  editorVariant="popover"
                />
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
                className={responsiveColumnClassName.goalCoverage}
              />
            ),
            cellClassName: responsiveColumnClassName.goalCoverage,
            cell: (municipality) => (
              <MunicipalityListGoalCoverageCell
                coverageByScenario={municipality.goalCoverageByScenario}
              />
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
                {municipalityColumnLabels.lastSignal}
              </MunicipalitySortableHead>
            ),
            cell: (municipality) => renderSignalCell(municipality, 'adaptive'),
          },
          {
            // B172 — below 60rem the trend column disappears
            // (`responsiveColumnClassName.trend`) and the same editor is mounted
            // here as a compact trigger. The column is always mounted so the
            // width fallback has a home when the picker shows trend; it is gated
            // closed above 60rem unless a manual hide pins it open.
            id: 'actions',
            label: 'Ações',
            mandatory: true,
            head: (
              <CampaignTableHead
                align="right"
                className={actionsAlwaysVisible ? undefined : actionsWidthGateClass}
              >
                <span className="sr-only">Ações</span>
              </CampaignTableHead>
            ),
            cellClassName: cn(
              'text-right',
              actionsAlwaysVisible ? undefined : actionsWidthGateClass,
            ),
            cell: (municipality) => (
              <div className="flex items-center justify-end gap-1">
                {/* The compact trend trigger replaces its own column on a manual
                    hide or only backs it up below 60rem — never both at once. */}
                {trendIsHidden ? (
                  renderTrendCell(municipality, 'compact')
                ) : (
                  <span className={actionsWidthGateClass}>
                    {renderTrendCell(municipality, 'compact')}
                  </span>
                )}
                {signalIsHidden ? renderSignalCell(municipality, 'compact') : null}
              </div>
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
}

export const municipalityListPickerColumns = ({
  isStaffView,
}: Pick<MunicipalityListProps, 'isStaffView'>): CampaignColumnPickerColumn[] => {
  const base: CampaignColumnPickerColumn[] = [
    { id: 'name', label: municipalityColumnLabels.name, mandatory: true },
    { id: 'votos', label: municipalityColumnLabels.votos },
  ]
  if (!isStaffView) return base

  return [
    ...base,
    { id: 'expectedVotes', label: municipalityColumnLabels.expectedVotes },
    { id: 'level', label: municipalityColumnLabels.level },
    { id: 'classe', label: municipalityColumnLabels.classe },
    { id: 'advisors', label: municipalityColumnLabels.advisors },
    { id: 'trend', label: municipalityColumnLabels.trend },
    { id: 'leaderships', label: municipalityColumnLabels.leaderships },
    { id: 'stateDeputies', label: municipalityColumnLabels.stateDeputies },
    { id: 'goalCoverage', label: municipalityColumnLabels.goalCoverage },
    { id: 'lastSignal', label: municipalityColumnLabels.lastSignal },
  ]
}

export const MunicipalityList = (props: MunicipalityListProps) => {
  const {
    municipalities,
    advisorNamesById,
    leadershipNamesById,
    isStaffView,
    isCoordinator,
    isCampaignUnrestricted,
    advisorOptions,
    leadershipOptions,
    stateDeputyOptions,
    stateDeputyCommitAction,
    stateDeputyCreateAction,
    state,
  } = props
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
    <MunicipalityAdvisorCreateProvider>
      <MunicipalityLeadershipCreateProvider>
        <div data-container="municipality-list" className="@container/municipality-list">
          <MunicipalityListMobileSection
            municipalities={municipalities}
            advisorNamesById={advisorNamesById}
            leadershipNamesById={leadershipNamesById}
            isStaffView={isStaffView}
            isCoordinator={isCoordinator}
            isCampaignUnrestricted={isCampaignUnrestricted}
            canMoveEngagementLevel={props.canMoveEngagementLevel}
            advisorOptions={advisorOptions}
            leadershipOptions={leadershipOptions}
            stateDeputyOptions={stateDeputyOptions}
            stateDeputyCommitAction={stateDeputyCommitAction}
            stateDeputyCreateAction={stateDeputyCreateAction}
            signalFormAction={props.signalFormAction}
            emptySlot={<MunicipalityListEmptyState state={state} />}
          />

          {/* A sticky <th> can't paint the row border, hence the inset shadow. */}
          <CampaignTable
            className="hidden overflow-visible @min-[48rem]/municipality-list:block"
            containerClassName="overflow-x-auto supports-[container-type:inline-size]:overflow-x-hidden"
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
        </div>
      </MunicipalityLeadershipCreateProvider>
    </MunicipalityAdvisorCreateProvider>
  )
}
