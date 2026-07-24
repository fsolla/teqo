import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import Link from 'next/link'

import { MunicipalityAdvisorAvatarStack } from '@/components/campaign/MunicipalityAdvisorAvatarStack'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/MunicipalityListExpectedVotesControl'
import { MunicipalityListTrendControl } from '@/components/campaign/MunicipalityListTrendControl'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatMunicipalityGeographyLabel,
  municipalityKindLabels,
  municipalityPriorityLabels,
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
}

export const MunicipalityList = ({
  municipalities,
  advisorNamesById,
  isStaffView,
  isCoordinator,
  advisorOptions,
  trendFormAction,
  advisorsFormAction,
}: MunicipalityListProps) => {
  const advisorEntries = (municipality: MunicipalityListViewModel) =>
    municipality.advisorIDs.flatMap((id) => {
      const advisor = advisorNamesById.get(id)
      return advisor ? [{ id: advisor.id, name: advisor.name }] : []
    })

  const advisorNames = (municipality: MunicipalityListViewModel): string[] =>
    advisorEntries(municipality).map((advisor) => advisor.name)

  return (
    <>
      <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
        {municipalities.map((municipality) => {
          const names = advisorNames(municipality)
          return (
            <article key={municipality.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{municipality.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatMunicipalityGeographyLabel(municipality)}
                  </p>
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
                <Link href={`/campanha/municipios/${municipality.slug}`}>Abrir Praça</Link>
              </Button>
            </article>
          )
        })}
      </div>

      <div data-view="desktop-table" className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Praça</TableHead>
              <TableHead>Território de identidade</TableHead>
              <TableHead>Tipo</TableHead>
              {isStaffView ? (
                <>
                  <TableHead>Assessores</TableHead>
                  <TableHead>Tendência</TableHead>
                  <TableHead className="text-center">Votos estimados</TableHead>
                  <TableHead>Última atualização</TableHead>
                  <TableHead>Cobertura</TableHead>
                </>
              ) : (
                <TableHead>Última atualização</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {municipalities.map((municipality) => {
              const names = advisorNames(municipality)
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
                          <MunicipalityAdvisorAvatarStack advisors={advisorEntries(municipality)} />
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
