import { CircleAlertIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'

import {
  advisorEntriesFromIds,
  formatAdvisorNamesTooltip,
  MissingAdvisorBadge,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListGoalCoverageCell } from '@/components/campaign/municipality/MunicipalityListGoalCoverageCell'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { MunicipalityListSignalControl } from '@/components/campaign/municipality/MunicipalityListSignalControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalitySortableHead } from '@/components/campaign/municipality/MunicipalitySortableHead'
import { TerritoryLink } from '@/components/campaign/municipality/TerritoryLink'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
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
  type CampaignColumnVisibility,
} from '@/lib/campaignColumnVisibility'
import {
  formatElectionNumber,
  formatPlacementOrdinal,
  formatVoteSharePercent,
} from '@/lib/electionFormat'
import { formatEngagementLevelLabel } from '@/lib/engagementLevel'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatTerritorialClassWhy,
  municipalityColumnDescriptions,
  municipalityGeographyParts,
  municipalityKindLabels,
  municipalityPriorityLabels,
  territorialClassBadgeVariant,
  territorialClassLabels,
  type MunicipalityListColumnId,
} from '@/utilities/municipalityLabels'
import {
  clearMunicipalityListFilters,
  type MunicipalityFilterOption,
} from '@/utilities/municipalityListFilters'
import {
  buildMunicipalityListHref,
  formatMunicipalityListSortSummary,
  municipalityColumnLabels,
  resolveMunicipalityListSort,
  type MunicipalityListState,
} from '@/utilities/municipalityListUrl'
import {
  formatMunicipalitySignalAgeLabel,
  isMunicipalitySignalCold,
  MUNICIPALITY_COLD_SIGNAL_DAYS,
  municipalitySignalAgeInDays,
} from '@/utilities/municipalitySignal'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipalityViewModels'
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

const VotePositionReadout = ({
  position,
  layout,
}: {
  position: NonNullable<MunicipalityListViewModel['votePosition2022']>
  layout: 'table' | 'card'
}) => {
  const share = formatVoteSharePercent(position.share)
  const rank = formatPlacementOrdinal(position.rank)
  const metaLine = `${formatElectionNumber(position.votes)} · ${rank}`
  const ariaLabel = `${share} da votação estadual, ${formatElectionNumber(position.votes)} votos, ${rank} de ${formatElectionNumber(position.totalUnits)}`

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 tabular-nums',
        layout === 'table' ? 'items-end text-right' : 'text-sm',
      )}
      aria-label={ariaLabel}
    >
      <span className={cn('font-medium', layout === 'card' && 'text-foreground')}>{share}</span>
      <span className="text-xs text-muted-foreground">{metaLine}</span>
    </div>
  )
}

/**
 * E10 classe. Only the pill is visible — spelling the factors out under it
 * bloats the dense row on desktop and, on the mobile card, was the tallest
 * block in a card the field asked us to shorten (B42). So the "por quê" is
 * `sr-only` text here, and both surfaces add a tap/hover/focus channel around
 * it: the column's `cellTooltip` in the table, an explicit `CampaignHoverTooltip`
 * on the card. Neither may be dropped — the class must never reach anyone,
 * sighted or not, as a bare verdict.
 */
const TerritorialClassReadout = ({ municipality }: { municipality: MunicipalityListViewModel }) => {
  const why = formatTerritorialClassWhy(municipality.territorialClassFactors)

  if (municipality.territorialClass === 'sem_base') {
    // Same idiom as the "2022" column: absent data is a dash, not a pill.
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{why}</span>
      </span>
    )
  }

  return (
    <>
      <Badge variant={territorialClassBadgeVariant[municipality.territorialClass]}>
        {territorialClassLabels[municipality.territorialClass]}
      </Badge>
      <span className="sr-only">{why}</span>
    </>
  )
}

/**
 * E9 frescor: how long since anybody recorded anything here (staff update or
 * leadership pledge).
 *
 * Cold reads in the warning amber, NOT destructive: early in the campaign
 * most municípios are past the 21-day threshold, and painting them all red
 * would drown the one state that really is an error in this list — a priority
 * município with nobody answering for it. Same reason it stays text with an
 * icon instead of a third badge: the row already carries the priority pill and,
 * when it applies, the missing-advisor one.
 */
const SignalAgeReadout = ({
  lastSignalAt,
  layout,
}: {
  lastSignalAt: string | null
  layout: 'table' | 'card'
}) => {
  const ageInDays = municipalitySignalAgeInDays(lastSignalAt)
  const isCold = isMunicipalitySignalCold(ageInDays)
  const ageLabel = formatMunicipalitySignalAgeLabel(ageInDays)
  const dateLabel = lastSignalAt ? dateFormatter.format(new Date(lastSignalAt)) : null

  return (
    <div
      data-signal={isCold ? 'cold' : 'fresh'}
      className={cn('flex flex-col gap-0.5', layout === 'card' && 'text-sm')}
      title={
        isCold
          ? `Sem registro novo há ${MUNICIPALITY_COLD_SIGNAL_DAYS} dias ou mais — atualização da equipe ou declaração de liderança.`
          : undefined
      }
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 tabular-nums',
          isCold ? 'font-medium text-estimate-pending-foreground' : 'text-foreground',
        )}
      >
        {isCold ? <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        {ageLabel}
      </span>
      {dateLabel ? (
        <span className="text-xs text-muted-foreground tabular-nums">{dateLabel}</span>
      ) : null}
    </div>
  )
}

/** Replaces only the rows: the filter header row and the overview stay put. */
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

const advisorNames = (
  municipality: MunicipalityListViewModel,
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>,
): string[] => advisorEntries(municipality, advisorNamesById).map((advisor) => advisor.name)

/** The desktop table as column definitions (Pass 2 W1 list system). */
/**
 * The id is the picker's key, the cookie's key and the key of the B22
 * description record, so it is typed instead of widening to `string`.
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
        {municipality.priority === 'alta' && isStaffView ? (
          <Badge variant="destructive">{municipalityPriorityLabels.alta}</Badge>
        ) : null}
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
    id: 'kind',
    label: municipalityColumnLabels.kind,
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="kind"
        filterParam="kind"
        description={municipalityColumnDescriptions.kind}
      />
    ),
    cell: (municipality) => municipalityKindLabels[municipality.kind],
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
        <VotePositionReadout position={municipality.votePosition2022} layout="table" />
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

      <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
        {municipalities.length === 0 ? <MunicipalityListEmptyState state={state} /> : null}
        {municipalities.map((municipality) => {
          const names = advisorNames(municipality, advisorNamesById)
          const position = municipality.votePosition2022
          const isPriority = municipality.priority === 'alta'
          const { region, zoneSuffix } = municipalityGeographyParts(municipality)
          return (
            <article
              key={municipality.id}
              className="relative flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  {/*
                   * The name's link stretches over the whole card, so tapping
                   * anywhere that isn't a control opens the município — B42
                   * removed the "Abrir município" button that used to be the
                   * only way in. Each control carries its own `relative`,
                   * which paints it above this overlay and keeps its own tap;
                   * nothing else in the card may be positioned, or it would
                   * become a hole in the card's tap target.
                   */}
                  <h3 className="font-medium">
                    <Link
                      href={`/campanha/municipios/${municipality.slug}`}
                      className="rounded-md after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {municipality.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <span className="relative">
                      <TerritoryLink region={region} />
                    </span>
                    {zoneSuffix ? ` ${zoneSuffix}` : null}
                  </p>
                  {position ? <VotePositionReadout position={position} layout="card" /> : null}
                </div>
                {isPriority && isStaffView ? (
                  <Badge variant="destructive">{municipalityPriorityLabels.alta}</Badge>
                ) : null}
              </div>
              {isStaffView ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Classe</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      {/*
                       * The card has no hover, so the "por quê" the class must
                       * never travel without gets the same tap-to-open channel
                       * the desktop column gets through `cellTooltip` — the
                       * `sr-only` copy inside the readout covers AT either way.
                       */}
                      <CampaignHoverTooltip
                        content={
                          municipality.territorialClass === 'sem_base'
                            ? null
                            : formatTerritorialClassWhy(municipality.territorialClassFactors)
                        }
                        align="start"
                      >
                        <span className="relative inline-flex items-center">
                          <TerritorialClassReadout municipality={municipality} />
                        </span>
                      </CampaignHoverTooltip>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {municipalityColumnLabels.goalCoverage}
                    </dt>
                    <dd>
                      <MunicipalityListGoalCoverageCell
                        coverageByScenario={municipality.goalCoverageByScenario}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Votos estimados</dt>
                    <dd>
                      <MunicipalityListExpectedVotesControl
                        municipalityID={municipality.id}
                        municipalityName={municipality.name}
                        expectedVotes={municipality.expectedVotes}
                        pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                        variant="sheet"
                      />
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Nível</dt>
                    <dd>
                      {props.canMoveEngagementLevel ? (
                        <MunicipalityListLevelControl
                          municipalityID={municipality.id}
                          municipalityName={municipality.name}
                          level={municipality.engagementLevel}
                          levelNote={municipality.levelNote}
                          levelChangedAt={municipality.levelChangedAt}
                          variant="sheet"
                        />
                      ) : (
                        <MunicipalityLevelBadge
                          level={municipality.engagementLevel}
                          note={municipality.levelNote}
                          layout="card"
                        />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tendência</dt>
                    <dd>
                      <MunicipalityListTrendControl
                        municipalityID={municipality.id}
                        municipalityName={municipality.name}
                        status={municipality.politicalTrendStatus}
                        trendNote={municipality.politicalTrendNote}
                        variant="sheet"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Último sinal</dt>
                    <dd>
                      <MunicipalityListSignalControl
                        municipalityID={municipality.id}
                        municipalitySlug={municipality.slug}
                        municipalityName={municipality.name}
                        lastSignalAt={municipality.lastSignalAt}
                        variant="sheet"
                        formAction={props.signalFormAction}
                      >
                        <SignalAgeReadout lastSignalAt={municipality.lastSignalAt} layout="card" />
                      </MunicipalityListSignalControl>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Assessores</dt>
                    <dd>
                      {isCoordinator ? (
                        <MunicipalityListAdvisorsControl
                          municipalityID={municipality.id}
                          municipalityName={municipality.name}
                          currentAdvisorIDs={municipality.advisorIDs}
                          isPriority={isPriority}
                          advisorNamesById={advisorNamesById}
                          options={advisorOptions}
                          variant="sheet"
                        />
                      ) : names.length ? (
                        names.join(', ')
                      ) : (
                        <MissingAdvisorBadge isPriority={isPriority} />
                      )}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </article>
          )
        })}
      </div>

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
