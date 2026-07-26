import { CircleAlertIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'

import {
  MissingAdvisorBadge,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListGoalCoverageCell } from '@/components/campaign/municipality/MunicipalityListGoalCoverageCell'
import { MunicipalityListSignalControl } from '@/components/campaign/municipality/MunicipalityListSignalControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalitySortableHead } from '@/components/campaign/municipality/MunicipalitySortableHead'
import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { CampaignTable, type CampaignTableColumn } from '@/components/campaign/shared/CampaignTable'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { formatElectionNumber, formatVoteSharePercent } from '@/lib/electionFormat'
import { formatMunicipalityVoteRank } from '@/lib/municipalityVoteRank'
import { cn } from '@/lib/utils'
import { DEFAULT_VOTE_ESTIMATE_SCENARIO, voteEstimateScenarioLabels } from '@/lib/voteEstimate'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatMunicipalityConcentrationHint,
  formatMunicipalityGeographyLabel,
  formatTerritorialClassWhy,
  municipalityKindLabels,
  municipalityPriorityLabels,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipalityLabels'
import {
  clearMunicipalityListFilters,
  type MunicipalityFilterOption,
} from '@/utilities/municipalityListFilters'
import {
  buildMunicipalityListHref,
  formatMunicipalityListSortSummary,
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
  advisorOptions: EligibleAdvisorOption[]
  columnFilterOptions: MunicipalityColumnFilterOptions
  trendFormAction: MunicipalityStaffFormAction
  advisorsFormAction: MunicipalityStaffFormAction
  signalFormAction: MunicipalityStaffFormAction
  state: MunicipalityListState
}

const VotePositionReadout = ({
  position,
  layout,
}: {
  position: NonNullable<MunicipalityListViewModel['votePosition2022']>
  layout: 'table' | 'card'
}) => {
  const share = formatVoteSharePercent(position.share)
  const rank = formatMunicipalityVoteRank(position.rank)
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

const CLASS_COLUMN_HINT =
  'Leitura relativa de 2022: o desempenho aqui contra o padrão estadual do próprio candidato. Reduto (bem acima do padrão), Expansão (abaixo, mas com campo a ocupar), Manutenção (no padrão), Marginal (abaixo, com pouco campo) e — sem série do TSE. É sugestão de leitura, não decisão: cada classe traz o porquê ao passar o mouse ou tocar nela.'

/**
 * E10 classe. In the table only the pill is visible — spelling the factors out
 * under it made this the widest cell in a grid that cannot scroll
 * horizontally, so the "por quê" moves to the column's `cellTooltip` (hover,
 * focus and tap) and stays as `sr-only` text; the card has the width to show
 * it outright. Either way the class never reaches anyone as a bare verdict,
 * which is the one thing it must never be.
 */
const TerritorialClassReadout = ({
  municipality,
  layout,
}: {
  municipality: MunicipalityListViewModel
  layout: 'table' | 'card'
}) => {
  const isTable = layout === 'table'
  const why = formatTerritorialClassWhy(municipality.territorialClassFactors)

  if (municipality.territorialClass === 'sem_base') {
    // Same idiom as the "2022" column: absent data is a dash, not a pill.
    return isTable ? (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{why}</span>
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">{why}</span>
    )
  }

  return (
    <>
      <Badge variant={territorialClassBadgeVariant[municipality.territorialClass]}>
        {territorialClassLabels[municipality.territorialClass]}
      </Badge>
      <span className={isTable ? 'sr-only' : 'text-xs text-muted-foreground'}>{why}</span>
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
) =>
  municipality.advisorIDs.flatMap((id) => {
    const advisor = advisorNamesById.get(id)
    return advisor ? [{ id: advisor.id, name: advisor.name }] : []
  })

const advisorNames = (
  municipality: MunicipalityListViewModel,
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>,
): string[] => advisorEntries(municipality, advisorNamesById).map((advisor) => advisor.name)

/** The desktop table as column definitions (Pass 2 W1 list system). */
const municipalityListColumns = ({
  state,
  isStaffView,
  isCoordinator,
  columnFilterOptions,
  advisorNamesById,
  advisorOptions,
  trendFormAction,
  advisorsFormAction,
  signalFormAction,
  concentrationHint,
  signalHint,
  deficitHint,
}: MunicipalityListProps & {
  concentrationHint: string
  signalHint: string
  deficitHint: string
}): Array<CampaignTableColumn<MunicipalityListViewModel>> => [
  {
    id: 'name',
    mandatory: true,
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="name"
        filterParam="name"
        filterOptions={columnFilterOptions.name}
        showPriorityFilter={isStaffView}
      >
        Município
      </MunicipalitySortableHead>
    ),
    cellClassName: 'max-w-52 whitespace-normal',
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
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="region"
        filterParam="region"
        filterOptions={columnFilterOptions.region}
      >
        Território
      </MunicipalitySortableHead>
    ),
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (municipality) => municipality.region,
  },
  {
    id: 'kind',
    head: (
      <MunicipalitySortableHead state={state} sortKey="kind" filterParam="kind">
        Tipo
      </MunicipalitySortableHead>
    ),
    cell: (municipality) => municipalityKindLabels[municipality.kind],
  },
  {
    id: 'votos',
    head: (
      <MunicipalitySortableHead
        state={state}
        sortKey="votos"
        align="right"
        tooltip={concentrationHint}
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
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="classe"
              filterParam="class"
              tooltip={CLASS_COLUMN_HINT}
            >
              Classe
            </MunicipalitySortableHead>
          ),
          cell: (municipality) => (
            <TerritorialClassReadout municipality={municipality} layout="table" />
          ),
          // The factors behind the label — the cell keeps them as `sr-only`
          // text, so this stays a redundant affordance (see `cellTooltip`).
          cellTooltip: (municipality) =>
            municipality.territorialClass === 'sem_base'
              ? null
              : formatTerritorialClassWhy(municipality.territorialClassFactors),
        },
        {
          id: 'advisors',
          head: (
            <MunicipalitySortableHead
              state={state}
              sortKey="coverage"
              filterParam="advisor"
              filterOptions={columnFilterOptions.advisor}
            >
              Assessores
            </MunicipalitySortableHead>
          ),
          cell: (municipality) =>
            isCoordinator ? (
              <MunicipalityListAdvisorsControl
                municipalityID={municipality.id}
                municipalitySlug={municipality.slug}
                currentAdvisorIDs={municipality.advisorIDs}
                isPriority={municipality.priority === 'alta'}
                advisorNamesById={advisorNamesById}
                options={advisorOptions}
                formAction={advisorsFormAction}
              />
            ) : (
              <MunicipalityAdvisorAvatarStack
                advisors={advisorEntries(municipality, advisorNamesById)}
                isPriority={municipality.priority === 'alta'}
              />
            ),
        },
        {
          id: 'trend',
          head: (
            <MunicipalitySortableHead state={state} sortKey="trend" filterParam="trend">
              Tendência
            </MunicipalitySortableHead>
          ),
          cell: (municipality) => (
            <MunicipalityListTrendControl
              municipalityID={municipality.id}
              municipalitySlug={municipality.slug}
              status={municipality.politicalTrendStatus}
              trendNote={municipality.politicalTrendNote}
              formAction={trendFormAction}
            />
          ),
        },
        {
          id: 'expectedVotes',
          head: (
            <MunicipalitySortableHead state={state} sortKey="expectedVotes" align="center">
              Votos estimados
            </MunicipalitySortableHead>
          ),
          cellClassName: 'relative overflow-visible align-middle text-center',
          cell: (municipality) => (
            <div className="flex min-h-11 items-center justify-center">
              <MunicipalityListExpectedVotesControl
                municipalityID={municipality.id}
                expectedVotes={municipality.expectedVotes}
                pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
              />
            </div>
          ),
        },
        {
          id: 'lastSignal',
          head: (
            <MunicipalitySortableHead state={state} sortKey="frescor" tooltip={signalHint}>
              Último sinal
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
          head: (
            <MunicipalitySortableHead state={state} sortKey="deficit" tooltip={deficitHint}>
              Cobertura da meta
            </MunicipalitySortableHead>
          ),
          cell: (municipality) => (
            <MunicipalityListGoalCoverageCell
              coverageByScenario={municipality.goalCoverageByScenario}
              layout="compact"
            />
          ),
        },
      ] satisfies Array<CampaignTableColumn<MunicipalityListViewModel>>)
    : ([
        {
          id: 'lastUpdateAt',
          head: (
            <MunicipalitySortableHead state={state} sortKey="lastUpdateAt">
              Última atualização
            </MunicipalitySortableHead>
          ),
          cell: (municipality) =>
            municipality.lastUpdateAt
              ? dateFormatter.format(new Date(municipality.lastUpdateAt))
              : 'Sem atualização',
        },
      ] satisfies Array<CampaignTableColumn<MunicipalityListViewModel>>)),
]

export const MunicipalityList = (props: MunicipalityListProps) => {
  const {
    municipalities,
    advisorNamesById,
    isStaffView,
    isCoordinator,
    advisorOptions,
    trendFormAction,
    state,
  } = props
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const sortSummary = formatMunicipalityListSortSummary(activeSort, activeDir)
  const concentrationHint = formatMunicipalityConcentrationHint()
  const signalHint = `Última atualização da equipe ou declaração de liderança, o que for mais recente. Fica destacado a partir de ${MUNICIPALITY_COLD_SIGNAL_DAYS} dias sem registro.`
  // The scenario picker is client state, so the server can only order by one
  // scenario — named here so the ordering never looks arbitrary.
  const deficitHint = `Ordena pelo que falta para a meta (meta − comprometido) no cenário ${voteEstimateScenarioLabels[DEFAULT_VOTE_ESTIMATE_SCENARIO]}, independente do cenário selecionado acima.`
  const columns = municipalityListColumns({
    ...props,
    concentrationHint,
    signalHint,
    deficitHint,
  })

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
          return (
            <article key={municipality.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{municipality.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatMunicipalityGeographyLabel(municipality)}
                  </p>
                  {position ? <VotePositionReadout position={position} layout="card" /> : null}
                </div>
                {isPriority && isStaffView ? (
                  <Badge variant="destructive">{municipalityPriorityLabels.alta}</Badge>
                ) : null}
              </div>
              {isStaffView ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Classe</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <TerritorialClassReadout municipality={municipality} layout="card" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Votos estimados</dt>
                    <dd className="flex justify-center">
                      <MunicipalityListExpectedVotesControl
                        municipalityID={municipality.id}
                        expectedVotes={municipality.expectedVotes}
                        pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tendência</dt>
                    <dd>
                      <MunicipalityListTrendControl
                        municipalityID={municipality.id}
                        municipalitySlug={municipality.slug}
                        status={municipality.politicalTrendStatus}
                        trendNote={municipality.politicalTrendNote}
                        formAction={trendFormAction}
                      />
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Cobertura da meta</dt>
                    <dd>
                      <MunicipalityListGoalCoverageCell
                        coverageByScenario={municipality.goalCoverageByScenario}
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
                          municipalitySlug={municipality.slug}
                          currentAdvisorIDs={municipality.advisorIDs}
                          isPriority={isPriority}
                          advisorNamesById={advisorNamesById}
                          options={advisorOptions}
                          formAction={props.advisorsFormAction}
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
              <Button asChild variant="outline" className="min-h-11 w-full">
                <Link href={`/campanha/municipios/${municipality.slug}`}>Abrir município</Link>
              </Button>
            </article>
          )
        })}
      </div>

      {/* No inner scroller: the app shell's <main> scrolls, so the sticky header
          resolves against it. A sticky <th> can't paint the row border, hence the
          inset shadow standing in for it. */}
      <CampaignTable
        className="hidden overflow-visible md:block"
        containerClassName="overflow-x-visible"
        headerClassName="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl [&_tr]:border-b-0"
        caption={
          <>
            {sortSummary}. Coluna 2022: {concentrationHint}
          </>
        }
        columns={columns}
        rows={municipalities}
        rowKey={(municipality) => municipality.id}
        empty={<MunicipalityListEmptyState state={state} />}
      />
    </>
  )
}
