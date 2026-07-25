import { CircleAlertIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'

import { CampaignTransitionAnchor } from '@/components/campaign/CampaignListPending'
import {
  MissingAdvisorBadge,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/MunicipalityAdvisorAvatarStack'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/MunicipalityListExpectedVotesControl'
import { MunicipalityListGoalCoverageCell } from '@/components/campaign/MunicipalityListGoalCoverageCell'
import { MunicipalityListTrendControl } from '@/components/campaign/MunicipalityListTrendControl'
import { MunicipalitySortableHead } from '@/components/campaign/MunicipalitySortableHead'
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { formatElectionNumber } from '@/lib/electionInsights'
import { formatMunicipalityVoteRank, formatMunicipalityVoteShare } from '@/lib/municipalityVoteRank'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  buildMunicipalityListHref,
  formatMunicipalityConcentrationHint,
  formatMunicipalityGeographyLabel,
  formatMunicipalityListSortSummary,
  formatMunicipalitySignalAgeLabel,
  isMunicipalitySignalCold,
  MUNICIPALITY_COLD_SIGNAL_DAYS,
  municipalityKindLabels,
  municipalityPriorityLabels,
  municipalitySignalAgeInDays,
  resolveMunicipalityListSort,
  type MunicipalityFilterOption,
  type MunicipalityListState,
} from '@/utilities/municipalityUi'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipalityViewModels'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  voteEstimateScenarioLabels,
} from '@/utilities/voteEstimate'
import { toMunicipalityPledgeCoverageView } from '@/utilities/votePledgeData'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type MunicipalityStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

type MunicipalityColumnFilterOptions = {
  name: MunicipalityFilterOption[]
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
  state: MunicipalityListState
}

const VotePositionReadout = ({
  position,
  layout,
}: {
  position: NonNullable<MunicipalityListViewModel['votePosition2022']>
  layout: 'table' | 'card'
}) => {
  const share = formatMunicipalityVoteShare(position.share)
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
        href={buildMunicipalityListHref({ page: 1, sort: state.sort, dir: state.dir }, 1)}
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

export const MunicipalityList = ({
  municipalities,
  advisorNamesById,
  isStaffView,
  isCoordinator,
  advisorOptions,
  columnFilterOptions,
  trendFormAction,
  advisorsFormAction,
  state,
}: MunicipalityListProps) => {
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const sortSummary = formatMunicipalityListSortSummary(activeSort, activeDir)
  const concentrationHint = formatMunicipalityConcentrationHint()
  const signalHint = `Última atualização da equipe ou declaração de liderança, o que for mais recente. Fica destacado a partir de ${MUNICIPALITY_COLD_SIGNAL_DAYS} dias sem registro.`
  // The scenario picker is client state, so the server can only order by one
  // scenario — named here so the ordering never looks arbitrary.
  const deficitHint = `Ordena pelo que falta para a meta (meta − comprometido) no cenário ${voteEstimateScenarioLabels[DEFAULT_VOTE_ESTIMATE_SCENARIO]}, independente do cenário selecionado acima.`
  // Keep in sync with the header row below.
  const columnCount = isStaffView ? 9 : 5

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
                      <SignalAgeReadout lastSignalAt={municipality.lastSignalAt} layout="card" />
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
                          formAction={advisorsFormAction}
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
      <div data-view="desktop-table" className="hidden rounded-xl border md:block">
        <Table containerClassName="overflow-x-visible">
          <TableCaption className="sr-only">
            {sortSummary}. Coluna 2022: {concentrationHint}
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl [&_tr]:border-b-0">
            <TableRow>
              <MunicipalitySortableHead
                state={state}
                sortKey="name"
                filterParam="name"
                filterOptions={columnFilterOptions.name}
                showPriorityFilter={isStaffView}
              >
                Município
              </MunicipalitySortableHead>
              <MunicipalitySortableHead
                state={state}
                sortKey="region"
                filterParam="region"
                filterOptions={columnFilterOptions.region}
              >
                Território
              </MunicipalitySortableHead>
              <MunicipalitySortableHead state={state} sortKey="kind" filterParam="kind">
                Tipo
              </MunicipalitySortableHead>
              <MunicipalitySortableHead
                state={state}
                sortKey="votos"
                align="right"
                tooltip={concentrationHint}
              />
              {isStaffView ? (
                <>
                  <MunicipalitySortableHead
                    state={state}
                    sortKey="coverage"
                    filterParam="advisor"
                    filterOptions={columnFilterOptions.advisor}
                  >
                    Assessores
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead state={state} sortKey="trend" filterParam="trend">
                    Tendência
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead state={state} sortKey="expectedVotes" align="center">
                    Votos estimados
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead
                    state={state}
                    sortKey="frescor"
                    tooltip={signalHint}
                  >
                    Último sinal
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead
                    state={state}
                    sortKey="deficit"
                    tooltip={deficitHint}
                  >
                    Cobertura da meta
                  </MunicipalitySortableHead>
                </>
              ) : (
                <MunicipalitySortableHead state={state} sortKey="lastUpdateAt">
                  Última atualização
                </MunicipalitySortableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {municipalities.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="whitespace-normal">
                  <MunicipalityListEmptyState state={state} />
                </TableCell>
              </TableRow>
            ) : null}
            {municipalities.map((municipality) => {
              const isPriority = municipality.priority === 'alta'
              return (
                <TableRow key={municipality.id}>
                  <TableCell className="max-w-52 whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campanha/municipios/${municipality.slug}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {municipality.name}
                      </Link>
                      {isPriority && isStaffView ? (
                        <Badge variant="destructive">{municipalityPriorityLabels.alta}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                    {municipality.region}
                  </TableCell>
                  <TableCell>{municipalityKindLabels[municipality.kind]}</TableCell>
                  <TableCell className="text-right">
                    {municipality.votePosition2022 ? (
                      <VotePositionReadout
                        position={municipality.votePosition2022}
                        layout="table"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {isStaffView ? (
                    <>
                      <TableCell>
                        {isCoordinator ? (
                          <MunicipalityListAdvisorsControl
                            municipalityID={municipality.id}
                            municipalitySlug={municipality.slug}
                            currentAdvisorIDs={municipality.advisorIDs}
                            isPriority={isPriority}
                            advisorNamesById={advisorNamesById}
                            options={advisorOptions}
                            formAction={advisorsFormAction}
                          />
                        ) : (
                          <MunicipalityAdvisorAvatarStack
                            advisors={advisorEntries(municipality, advisorNamesById)}
                            isPriority={isPriority}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <MunicipalityListTrendControl
                          municipalityID={municipality.id}
                          municipalitySlug={municipality.slug}
                          status={municipality.politicalTrendStatus}
                          trendNote={municipality.politicalTrendNote}
                          formAction={trendFormAction}
                        />
                      </TableCell>
                      <TableCell className="relative overflow-visible align-middle text-center">
                        <div className="flex min-h-11 items-center justify-center">
                          <MunicipalityListExpectedVotesControl
                            municipalityID={municipality.id}
                            expectedVotes={municipality.expectedVotes}
                            pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <SignalAgeReadout
                          lastSignalAt={municipality.lastSignalAt}
                          layout="table"
                        />
                      </TableCell>
                      <TableCell>
                        <MunicipalityListGoalCoverageCell
                          coverageByScenario={municipality.goalCoverageByScenario}
                          layout="compact"
                        />
                      </TableCell>
                    </>
                  ) : (
                    <TableCell>
                      {municipality.lastUpdateAt
                        ? dateFormatter.format(new Date(municipality.lastUpdateAt))
                        : 'Sem atualização'}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
