import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import Link from 'next/link'

import { MunicipalityAdvisorAvatarStack } from '@/components/campaign/MunicipalityAdvisorAvatarStack'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/MunicipalityListExpectedVotesControl'
import { MunicipalityListTrendControl } from '@/components/campaign/MunicipalityListTrendControl'
import { MunicipalitySortableHead } from '@/components/campaign/MunicipalitySortableHead'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { formatElectionNumber } from '@/lib/electionInsights'
import {
  formatMunicipalityVoteRank,
  formatMunicipalityVoteShare,
} from '@/lib/municipalityVoteRank'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatMunicipalityConcentrationHint,
  formatMunicipalityGeographyLabel,
  formatMunicipalityListSortSummary,
  municipalityKindLabels,
  municipalityPriorityLabels,
  resolveMunicipalityListSort,
  type MunicipalityListState,
} from '@/utilities/municipalityUi'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipalityViewModels'
import { toMunicipalityPledgeCoverageView } from '@/utilities/votePledgeData'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type MunicipalityStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

export type MunicipalityListProps = {
  municipalities: MunicipalityListViewModel[]
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  isStaffView: boolean
  isCoordinator: boolean
  advisorOptions: EligibleAdvisorOption[]
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
  trendFormAction,
  advisorsFormAction,
  state,
}: MunicipalityListProps) => {
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const sortSummary = formatMunicipalityListSortSummary(activeSort, activeDir)
  const concentrationHint = formatMunicipalityConcentrationHint()

  return (
    <>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {sortSummary}
      </p>

      <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
        {municipalities.map((municipality) => {
          const names = advisorNames(municipality, advisorNamesById)
          const position = municipality.votePosition2022
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
                {municipality.priority === 'alta' && isStaffView ? (
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
                    <dt className="text-muted-foreground">Assessoria</dt>
                    <dd>
                      {isCoordinator ? (
                        <MunicipalityListAdvisorsControl
                          municipalityID={municipality.id}
                          municipalitySlug={municipality.slug}
                          currentAdvisorIDs={municipality.advisorIDs}
                          advisorNamesById={advisorNamesById}
                          options={advisorOptions}
                          formAction={advisorsFormAction}
                        />
                      ) : names.length ? (
                        names.join(', ')
                      ) : (
                        'Sem assessor'
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

      <div data-view="desktop-table" className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableCaption className="sr-only">
            {sortSummary}. Coluna 2022: {concentrationHint}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <MunicipalitySortableHead state={state} sortKey="name">
                Município
              </MunicipalitySortableHead>
              <MunicipalitySortableHead state={state} sortKey="region">
                Território de identidade
              </MunicipalitySortableHead>
              <MunicipalitySortableHead state={state} sortKey="kind">
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
                  <TableHead>Assessores</TableHead>
                  <MunicipalitySortableHead state={state} sortKey="trend">
                    Tendência
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead state={state} sortKey="expectedVotes" align="center">
                    Votos estimados
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead state={state} sortKey="lastUpdateAt">
                    Última atualização
                  </MunicipalitySortableHead>
                  <MunicipalitySortableHead state={state} sortKey="coverage">
                    Cobertura
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
            {municipalities.map((municipality) => {
              const hasAdvisor = municipality.advisorIDs.length > 0

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
                      {municipality.priority === 'alta' && isStaffView ? (
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
                            advisorNamesById={advisorNamesById}
                            options={advisorOptions}
                            formAction={advisorsFormAction}
                          />
                        ) : (
                          <MunicipalityAdvisorAvatarStack
                            advisors={advisorEntries(municipality, advisorNamesById)}
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
                        {municipality.lastUpdateAt
                          ? dateFormatter.format(new Date(municipality.lastUpdateAt))
                          : 'Sem atualização'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={hasAdvisor ? 'estimate-confirmed' : 'estimate-pending'}>
                          {hasAdvisor ? (
                            <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
                          ) : (
                            <CircleAlertIcon data-icon="inline-start" aria-hidden="true" />
                          )}
                          {hasAdvisor ? 'Coberta' : 'Sem assessor'}
                        </Badge>
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
