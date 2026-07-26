import Link from 'next/link'

import { ActivityStatusBadge } from '@/components/campaign/activity/ActivityStatusBadge'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { MunicipalityBaselineCard } from '@/components/campaign/municipality/MunicipalityBaselineCard'
import { MunicipalityStrategyCard } from '@/components/campaign/municipality/MunicipalityStrategyCard'
import { MunicipalityUpdateFeed } from '@/components/campaign/municipality/MunicipalityUpdateFeed'
import { Badge } from '@/components/ui/Badge'
import type { MunicipalityAgeBandKey } from '@/lib/bahiaMunicipalityDemographics'
import { formatElectionNumber } from '@/lib/electionFormat'
import { activityKindLabels } from '@/lib/schemas/activity'
import type { ActivityListViewModel } from '@/utilities/activityViewModels'
import { formatBahiaDateTimeLabel } from '@/utilities/campaignTime'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageRatioLabel,
  formatRatioAsPercentLabel,
} from '@/utilities/goalCoverage'
import type { MunicipalityDossierData } from '@/utilities/municipalityDossierData'
import {
  formatMunicipalityGeographyLabel,
  formatTerritorialClassWhy,
  municipalityKindLabels,
  municipalityPriorityLabels,
  politicalTrendBadgeVariant,
  politicalTrendLabels,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipalityLabels'
import type {
  MunicipalityAdvisorSummary,
  MunicipalityDetailViewModel,
} from '@/utilities/municipalityViewModels'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

const AGE_BAND_LABELS: Record<MunicipalityAgeBandKey, string> = {
  '0-17': '0–17 anos',
  '18-29': '18–29 anos',
  '30-59': '30–59 anos',
  '60+': '60+ anos',
}

const SectionHeader = ({
  id,
  title,
  seeAllHref,
  seeAllLabel,
}: {
  id: string
  title: string
  seeAllHref?: string
  seeAllLabel?: string
}) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2">
    <h2 id={id} className="text-base font-medium">
      {title}
    </h2>
    {seeAllHref ? (
      <Link
        href={seeAllHref}
        scroll={false}
        className="text-sm text-primary underline-offset-4 hover:underline print:hidden"
      >
        {seeAllLabel ?? 'Ver tudo'}
      </Link>
    ) : null}
  </div>
)

const ActivityListItem = ({ activity }: { activity: ActivityListViewModel }) => (
  <li className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/campanha/atividades/${activity.slug}`}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {activity.title}
      </Link>
      <Badge variant="secondary">{activityKindLabels[activity.kind]}</Badge>
      <ActivityStatusBadge status={activity.status} />
      {activity.deputyPresent ? <Badge>Deputado presente</Badge> : null}
    </div>
    <p className="text-xs text-muted-foreground">
      {activity.startAt ? formatBahiaDateTimeLabel(activity.startAt) : 'Sem data definida'}
      {activity.locality ? ` · ${activity.locality}` : ''}
    </p>
  </li>
)

/**
 * E16 — "o que ler antes de entrar na cidade" (O6). A one-screen / 1–2 A4
 * page pre-visit read: capa, conta local (série TSE + conta da cadeira),
 * rede, conjuntura (estratégia, dobradinhas, emendas), agenda, sinais e
 * perfil do eleitorado. Composes the same loaders/cards the other tabs use —
 * numbers, short lists and prose; no charts (anti-goal do discovery).
 */
export const MunicipalityDossier = ({
  view,
  advisors,
  data,
}: {
  view: MunicipalityDetailViewModel
  advisors: MunicipalityAdvisorSummary[]
  data: MunicipalityDossierData
}) => {
  const strategy = view.strategy
  const trendStatus = strategy?.politicalTrend.status ?? null
  const goalAccount = data.goalAccount
  const territorialClass = goalAccount?.territorialClass ?? null
  const territorialClassWhy = territorialClass
    ? formatTerritorialClassWhy(territorialClass.factors)
    : null
  const usesMesaEstimate = strategy?.expectedVotes.central != null

  return (
    <div className="flex flex-col gap-6" data-dossier>
      {/* Capa — self-contained so the printed dossier keeps its identity
          after the page header/tab chrome is hidden by print CSS. */}
      <section
        aria-labelledby="dossier-cover-title"
        className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dossier-cover-title" className="text-lg font-semibold tracking-tight">
            Dossiê — {view.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            Gerado em {formatBahiaDateTimeLabel(new Date().toISOString())}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {municipalityKindLabels[view.kind]} · {formatMunicipalityGeographyLabel(view)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {strategy?.priority === 'alta' ? (
            <Badge variant="destructive">{municipalityPriorityLabels.alta}</Badge>
          ) : (
            <Badge variant="secondary">Prioridade normal</Badge>
          )}
          {trendStatus ? (
            <Badge variant={politicalTrendBadgeVariant[trendStatus]}>
              Tendência {politicalTrendLabels[trendStatus].toLowerCase()}
            </Badge>
          ) : (
            <Badge variant="outline">Tendência não registrada</Badge>
          )}
          {territorialClass ? (
            // Self-labeling like its two neighbors: on paper "Reduto" alone,
            // between "Prioridade" and "Tendência", reads as a fourth noun.
            <Badge variant={territorialClassBadgeVariant[territorialClass.class]}>
              Classe {territorialClassLabels[territorialClass.class].toLowerCase()}
            </Badge>
          ) : null}
        </div>
        {/* The class never travels alone on paper either — printed, nobody can
            hover the tooltip that carries the "por quê" on screen. */}
        {territorialClassWhy ? (
          <p className="text-xs text-muted-foreground">{territorialClassWhy}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {advisors.length
            ? `Assessoria: ${advisors.map((advisor) => advisor.name).join(', ')}`
            : 'Sem assessor designado.'}
          {view.lastUpdateAt
            ? ` · Última atualização em ${dateFormatter.format(new Date(view.lastUpdateAt))}`
            : ''}
        </p>
      </section>

      {/* Conta local — série TSE (reuses the elections-tab card) + conta da cadeira. */}
      <MunicipalityBaselineCard baseline={data.baseline} municipalitySlug={view.slug} />

      {goalAccount ? (
        <section
          aria-labelledby="dossier-goal-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <SectionHeader id="dossier-goal-title" title="Conta da cadeira" />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Meta usada</dt>
              <dd className="tabular-nums">
                {formatElectionNumber(goalAccount.goalCoverage.goal)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {usesMesaEstimate ? 'estimativa da mesa' : 'meta sugerida'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Comprometido (pledges)</dt>
              <dd className="tabular-nums">
                {formatElectionNumber(goalAccount.goalCoverage.committed)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {data.pledgeAggregate.pledgeCount
                  ? `${formatElectionNumber(data.pledgeAggregate.pledgeCount)} declaração(ões)`
                  : 'nenhuma declaração'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cobertura da meta</dt>
              <dd className="tabular-nums">
                {formatGoalCoverageRatioLabel(goalAccount.goalCoverage)}
              </dd>
              <dd className="text-xs text-muted-foreground tabular-nums">
                {formatGoalCoverageDeficitLabel(goalAccount.goalCoverage)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Captura (2022)</dt>
              <dd className="tabular-nums">
                {formatRatioAsPercentLabel(goalAccount.potential.captureRate2022)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                do teto do campo:{' '}
                {formatElectionNumber(Math.round(goalAccount.potential.projectedFieldCeiling))}{' '}
                (proj.)
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {/* Rede — quem receber/procurar na cidade, com frescor do cadastro. */}
      <section
        aria-labelledby="dossier-network-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <SectionHeader
          id="dossier-network-title"
          title={`Rede de lideranças (${formatElectionNumber(data.leaderships.totalCount)})`}
          seeAllHref={`/campanha/municipios/${view.slug}?tab=leaderships`}
          seeAllLabel="Ver todas"
        />
        {data.leaderships.rows.length ? (
          <ul className="flex flex-col divide-y">
            {data.leaderships.rows.map((leadership) => (
              <li
                key={leadership.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/campanha/liderancas/${leadership.id}`}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {leadership.name}
                  </Link>
                  {leadership.supportStatus ? (
                    <SupportStatusBadge status={leadership.supportStatus} />
                  ) : null}
                  {leadership.sector ? (
                    <span className="text-xs text-muted-foreground">{leadership.sector}</span>
                  ) : null}
                  {leadership.phone ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {leadership.phone}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {leadership.organizationNames.length ? (
                    <span>{leadership.organizationNames.join(', ')}</span>
                  ) : null}
                  <span>atualizada em {dateFormatter.format(new Date(leadership.updatedAt))}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma liderança vinculada a este município ainda.
          </p>
        )}
      </section>

      {/* Conjuntura, dobradinhas, encaminhamentos e emendas — reuses the
          overview strategy card (emendas render only when preenchidas). */}
      {strategy ? (
        <MunicipalityStrategyCard
          strategy={strategy}
          municipalitySlug={view.slug}
          canEdit={false}
        />
      ) : null}

      {/* Agenda — próximos eventos e últimas ações realizadas. */}
      <section
        aria-labelledby="dossier-agenda-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <SectionHeader
          id="dossier-agenda-title"
          title="Agenda no município"
          seeAllHref={`/campanha/atividades?municipality=${view.id}`}
          seeAllLabel="Ver agenda completa"
        />
        {data.upcomingActivities.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Próximos eventos</h3>
            <ul className="flex flex-col gap-2">
              {data.upcomingActivities.map((activity) => (
                <ActivityListItem key={activity.id} activity={activity} />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum evento futuro planejado.</p>
        )}
        {data.recentActivities.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Últimas ações realizadas</h3>
            <ul className="flex flex-col gap-2">
              {data.recentActivities.map((activity) => (
                <ActivityListItem key={activity.id} activity={activity} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Sinais recentes — reuses the updates-tab feed presentation. */}
      <section
        aria-labelledby="dossier-signals-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <SectionHeader
          id="dossier-signals-title"
          title={`Sinais e atualizações recentes (${formatElectionNumber(data.signals.totalCount)})`}
          seeAllHref={`/campanha/municipios/${view.slug}?tab=updates`}
        />
        <MunicipalityUpdateFeed updates={data.signals.rows} />
      </section>

      {/* Perfil do eleitorado — IBGE Censo 2022 (A8). */}
      {data.demographics ? (
        <DemographicsSection demographics={data.demographics} kind={view.kind} city={view.city} />
      ) : null}
    </div>
  )
}

const DemographicsSection = ({
  demographics,
  kind,
  city,
}: {
  demographics: NonNullable<MunicipalityDossierData['demographics']>
  kind: MunicipalityDetailViewModel['kind']
  city: string
}) => (
  <section
    aria-labelledby="dossier-profile-title"
    className="flex flex-col gap-3 rounded-xl border p-4"
  >
    <SectionHeader id="dossier-profile-title" title="Perfil da população (IBGE 2022)" />
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-xs text-muted-foreground">População</dt>
        <dd className="tabular-nums">{formatElectionNumber(demographics.population)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Idade mediana</dt>
        <dd className="tabular-nums">
          {demographics.medianAge != null
            ? `${formatElectionNumber(demographics.medianAge)} anos`
            : '—'}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Mulheres</dt>
        <dd className="tabular-nums">{formatRatioAsPercentLabel(demographics.sexShareFemale)}</dd>
      </div>
    </dl>
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      {(Object.keys(AGE_BAND_LABELS) as Array<keyof typeof AGE_BAND_LABELS>).map((band) => (
        <div key={band}>
          <dt className="text-xs text-muted-foreground">{AGE_BAND_LABELS[band]}</dt>
          <dd className="tabular-nums">{formatElectionNumber(demographics.ageBands[band])}</dd>
        </div>
      ))}
    </dl>
    {kind === 'zona' ? (
      <p className="text-xs text-muted-foreground">
        Dados do município inteiro de {city} — o IBGE não divide o Censo por zona eleitoral.
      </p>
    ) : null}
  </section>
)
