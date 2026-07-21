import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import Link from 'next/link'

import { PlazaListAdvisorsControl } from '@/components/campaign/PlazaListAdvisorsControl'
import { PlazaAdvisorAvatarStack } from '@/components/campaign/PlazaAdvisorAvatarStack'
import { PlazaListExpectedVotesControl } from '@/components/campaign/PlazaListExpectedVotesControl'
import { PlazaListTrendControl } from '@/components/campaign/PlazaListTrendControl'
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
  formatPlazaGeographyLabel,
  plazaKindLabels,
  plazaPriorityLabels,
} from '@/utilities/plazaUi'
import type {
  EligibleAdvisorOption,
  PlazaAdvisorSummary,
  PlazaListViewModel,
} from '@/utilities/plazaViewModels'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type PlazaStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

export type PlazaListProps = {
  plazas: PlazaListViewModel[]
  advisorNamesById: ReadonlyMap<number, PlazaAdvisorSummary>
  isStaffView: boolean
  isCoordinator: boolean
  advisorOptions: EligibleAdvisorOption[]
  expectedVotesFormAction: PlazaStaffFormAction
  trendFormAction: PlazaStaffFormAction
  advisorsFormAction: PlazaStaffFormAction
}

export const PlazaList = ({
  plazas,
  advisorNamesById,
  isStaffView,
  isCoordinator,
  advisorOptions,
  expectedVotesFormAction,
  trendFormAction,
  advisorsFormAction,
}: PlazaListProps) => {
  const advisorEntries = (plaza: PlazaListViewModel) =>
    plaza.advisorIDs.flatMap((id) => {
      const advisor = advisorNamesById.get(id)
      return advisor ? [{ id: advisor.id, name: advisor.name }] : []
    })

  const advisorNames = (plaza: PlazaListViewModel): string[] =>
    advisorEntries(plaza).map((advisor) => advisor.name)

  return (
    <>
      <div data-view="mobile-cards" className="flex flex-col gap-4 md:hidden">
        {plazas.map((plaza) => {
          const names = advisorNames(plaza)
          return (
            <article key={plaza.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{plaza.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatPlazaGeographyLabel(plaza)}
                  </p>
                </div>
                {plaza.priority === 'alta' && isStaffView ? (
                  <Badge variant="destructive">{plazaPriorityLabels.alta}</Badge>
                ) : null}
              </div>
              {isStaffView ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Votos estimados</dt>
                    <dd>
                      <PlazaListExpectedVotesControl
                        plazaID={plaza.id}
                        plazaSlug={plaza.slug}
                        expectedVotes={plaza.expectedVotes}
                        leadershipEffectiveTotal={plaza.pledges.effectiveTotal}
                        formAction={expectedVotesFormAction}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tendência</dt>
                    <dd>
                      <PlazaListTrendControl
                        plazaID={plaza.id}
                        plazaSlug={plaza.slug}
                        status={plaza.politicalTrendStatus}
                        trendNote={plaza.politicalTrendNote}
                        formAction={trendFormAction}
                      />
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Assessoria</dt>
                    <dd>
                      {isCoordinator ? (
                        <PlazaListAdvisorsControl
                          plazaID={plaza.id}
                          plazaSlug={plaza.slug}
                          currentAdvisorIDs={plaza.advisorIDs}
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
                <Link href={`/campanha/pracas/${plaza.slug}`}>Abrir Praça</Link>
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
                  <TableHead>Votos estimados</TableHead>
                  <TableHead>Última atualização</TableHead>
                  <TableHead>Cobertura</TableHead>
                </>
              ) : (
                <TableHead>Última atualização</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plazas.map((plaza) => {
              const names = advisorNames(plaza)
              const hasAdvisor = plaza.advisorIDs.length > 0

              return (
                <TableRow key={plaza.id}>
                  <TableCell className="max-w-52 whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campanha/pracas/${plaza.slug}`}
                        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {plaza.name}
                      </Link>
                      {plaza.priority === 'alta' && isStaffView ? (
                        <Badge variant="destructive">{plazaPriorityLabels.alta}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                    {plaza.region}
                  </TableCell>
                  <TableCell>{plazaKindLabels[plaza.kind]}</TableCell>
                  {isStaffView ? (
                    <>
                      <TableCell>
                        {isCoordinator ? (
                          <PlazaListAdvisorsControl
                            plazaID={plaza.id}
                            plazaSlug={plaza.slug}
                            currentAdvisorIDs={plaza.advisorIDs}
                            advisorNamesById={advisorNamesById}
                            options={advisorOptions}
                            formAction={advisorsFormAction}
                          />
                        ) : (
                          <PlazaAdvisorAvatarStack advisors={advisorEntries(plaza)} />
                        )}
                      </TableCell>
                      <TableCell>
                        <PlazaListTrendControl
                          plazaID={plaza.id}
                          plazaSlug={plaza.slug}
                          status={plaza.politicalTrendStatus}
                          trendNote={plaza.politicalTrendNote}
                          formAction={trendFormAction}
                        />
                      </TableCell>
                      <TableCell>
                        <PlazaListExpectedVotesControl
                          plazaID={plaza.id}
                          plazaSlug={plaza.slug}
                          expectedVotes={plaza.expectedVotes}
                          leadershipEffectiveTotal={plaza.pledges.effectiveTotal}
                          formAction={expectedVotesFormAction}
                        />
                      </TableCell>
                      <TableCell>
                        {plaza.lastUpdateAt
                          ? dateFormatter.format(new Date(plaza.lastUpdateAt))
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
                      {plaza.lastUpdateAt
                        ? dateFormatter.format(new Date(plaza.lastUpdateAt))
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
