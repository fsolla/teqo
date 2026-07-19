import type { Payload } from 'payload'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  MessageCircleIcon,
  PhoneIcon,
} from 'lucide-react'

import { createNucleusUpdateFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusUpdateFormActions'
import { searchPrimaryContactOptionsFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/primaryContactSearchActions'
import { LeadershipNetwork } from '@/components/campaign/LeadershipNetwork'
import { NucleusElectoralBaseline } from '@/components/campaign/NucleusElectoralBaseline'
import { NucleusInsights } from '@/components/campaign/NucleusInsights'
import { NucleusIntelligenceDialogShell } from '@/components/campaign/NucleusIntelligenceDialogShell'
import { NucleusUpdateFeed } from '@/components/campaign/NucleusUpdateFeed'
import { NucleusUpdateFormShell } from '@/components/campaign/NucleusUpdateFormShell'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/Empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { CampaignUser } from '@/payload-types'
import { loadNucleusActiveTabPageData } from '@/utilities/nucleusDetailPageData'
import {
  buildNucleusDetailTabHref,
  type NucleusDetailSearchParams,
  type NucleusDetailTab,
} from '@/utilities/nucleusDetailTabUi'
import type { AccessibleNucleusContext } from '@/utilities/nucleusPageData'
import { formatNucleusTerritoryLabel } from '@/utilities/nucleusUi'
import type {
  NucleusDetailViewModel,
  NucleusElectoralBaselineViewModel,
  NucleusTabsViewModel,
  StaffNucleusTabsViewModel,
} from '@/utilities/nucleusViewModels'
import {
  buildLeadershipPanelHref,
  parseLeadershipFilterState,
} from '@/utilities/leadershipUi'
import {
  parseNucleusUpdateListState,
  type NucleusUpdateViewModel,
} from '@/utilities/nucleusUpdateUi'
import { buildWhatsAppUrl } from '@/utilities/phone'

const OverviewContent = ({
  baseline,
  canEditIntelligence,
  confirmedVoteEstimate,
  context,
  nucleus,
  primaryContact,
  searchParams,
  updatePreview,
}: {
  baseline: NucleusElectoralBaselineViewModel | null
  canEditIntelligence: boolean
  confirmedVoteEstimate: number | null
  context: AccessibleNucleusContext
  nucleus: NucleusTabsViewModel
  primaryContact: { id: number; name: string; phone: string } | null
  searchParams: NucleusDetailSearchParams
  updatePreview: NucleusUpdateViewModel[]
}) => (
  <>
    {nucleus.kind === 'staff' ? (
      <>
        {canEditIntelligence ? (
          <div className="mb-4 flex justify-end">
            <NucleusIntelligenceDialogShell
              nucleusId={context.id}
              intelligence={{
                strengths: nucleus.strengths,
                risks: nucleus.risks,
                voterProfiles: nucleus.voterProfiles,
                ticketAlliance: nucleus.ticketAlliance,
              }}
              primaryContact={primaryContact}
              searchPrimaryContacts={searchPrimaryContactOptionsFormAction.bind(null, context.slug)}
            />
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pontos fortes</CardTitle>
            </CardHeader>
            <CardContent>
              {nucleus.strengths.length ? (
                <ul className="flex list-disc flex-col gap-2 pl-5">
                  {nucleus.strengths.map((strength) => (
                    <li key={strength.text}>{strength.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nenhum ponto forte registrado.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riscos identificados</CardTitle>
            </CardHeader>
            <CardContent>
              {nucleus.risks.length ? (
                <ul className="flex list-disc flex-col gap-2 pl-5">
                  {nucleus.risks.map((risk) => (
                    <li key={risk.text}>{risk.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nenhum risco registrado.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dobrada</CardTitle>
              <CardDescription>Parceria eleitoral deste núcleo</CardDescription>
            </CardHeader>
            <CardContent>
              {nucleus.ticketAlliance?.partnerName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{nucleus.ticketAlliance.partnerName}</strong>
                  {nucleus.ticketAlliance.office ? (
                    <span className="text-muted-foreground">
                      · {nucleus.ticketAlliance.office}
                    </span>
                  ) : null}
                  <Badge
                    variant={
                      nucleus.ticketAlliance.isCampaignPartner ? 'estimate-confirmed' : 'secondary'
                    }
                  >
                    {nucleus.ticketAlliance.isCampaignPartner ? (
                      <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
                    ) : null}
                    {nucleus.ticketAlliance.isCampaignPartner ? 'Parceiro' : 'Não confirmado'}
                  </Badge>
                  {nucleus.ticketAlliance.notes ? (
                    <p className="basis-full text-sm text-muted-foreground">
                      {nucleus.ticketAlliance.notes}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhuma dobrada registrada.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato principal</CardTitle>
              <CardDescription>Referência para articulação neste núcleo</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {primaryContact ? (
                <>
                  <strong>{primaryContact.name}</strong>
                  <a
                    href={`tel:+55${primaryContact.phone}`}
                    className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4"
                  >
                    <PhoneIcon aria-hidden="true" />
                    {primaryContact.phone}
                  </a>
                  <a
                    href={buildWhatsAppUrl(primaryContact.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4"
                  >
                    <MessageCircleIcon aria-hidden="true" />
                    Abrir no WhatsApp
                  </a>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Nenhum contato principal disponível para o seu escopo.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>Seu núcleo</CardTitle>
          <CardDescription>Informações básicas do território em que você atua</CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            {formatNucleusTerritoryLabel(nucleus)}
          </p>
        </CardContent>
      </Card>
    )}

    <div className="mt-4 flex flex-col gap-4">
      <NucleusElectoralBaseline baseline={baseline} />
      <NucleusInsights baseline={baseline} confirmedVoteEstimate={confirmedVoteEstimate} />
    </div>

    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Últimas atualizações</CardTitle>
        <CardDescription>Registros mais recentes deste núcleo</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {updatePreview.length ? (
          <>
            <ul className="flex flex-col gap-3">
              {updatePreview.map((update) => (
                <li key={update.id}>
                  <strong>{update.authorName}</strong>
                  <span className="text-muted-foreground">
                    {' · '}
                    {update.kind === 'semanal'
                      ? 'Semanal'
                      : update.kind === 'urgente'
                        ? 'Urgente'
                        : 'Nota'}
                  </span>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {update.body ?? update.worked}
                  </p>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="min-h-11 w-fit">
              <Link
                href={buildNucleusDetailTabHref(context.slug, 'updates', {
                  ...searchParams,
                  updatePage: '1',
                })}
              >
                Ver todas
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Nenhuma atualização registrada.</p>
        )}
      </CardContent>
    </Card>
  </>
)

const TerritoryContent = ({ nucleus }: { nucleus: NucleusTabsViewModel }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle>Território</CardTitle>
        <CardDescription>Bahia</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p>
          {formatNucleusTerritoryLabel(nucleus)}
        </p>
        {nucleus.kind === 'staff' && nucleus.territoryNotes ? (
          <p className="text-muted-foreground">{nucleus.territoryNotes}</p>
        ) : null}
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Zonas TSE</CardTitle>
      </CardHeader>
      <CardContent>
        {nucleus.tseZones.length ? (
          <div className="flex flex-wrap gap-2">
            {nucleus.tseZones.map((zoneNumber) => (
              <TseZoneBadge key={zoneNumber} zoneNumber={zoneNumber} />
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangleIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Nenhuma Zona TSE vinculada</EmptyTitle>
              <EmptyDescription>
                É opcional; ajuda a cruzar com o eleitorado oficial.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  </div>
)

const ElectorateContent = ({ nucleus }: { nucleus: StaffNucleusTabsViewModel }) =>
  nucleus.voterProfiles.length ? (
    <div className="grid gap-4 lg:grid-cols-2">
      {nucleus.voterProfiles.map((profile) => (
        <Card key={profile.label}>
          <CardHeader>
            <CardTitle>{profile.label}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {profile.ageRange ? <p>Faixa etária: {profile.ageRange}</p> : null}
            {profile.incomeBand ? <p>Renda: {profile.incomeBand}</p> : null}
            {profile.occupation ? <p>Ocupação: {profile.occupation}</p> : null}
            {profile.localTraits ? <p>{profile.localTraits}</p> : null}
            {profile.notes ? <p className="text-muted-foreground">{profile.notes}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Nenhum perfil do eleitorado cadastrado</EmptyTitle>
        <EmptyDescription>
          Perfis e inteligência eleitoral serão trabalhados na próxima etapa.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )

export const NucleusActiveTabLoading = () => (
  <div aria-label="Carregando seção" className="grid gap-4 lg:grid-cols-2">
    <Skeleton className="h-40" />
    <Skeleton className="h-40" />
  </div>
)

export const NucleusActiveTab = async ({
  activeTab,
  context,
  payload,
  searchParams,
  user,
  view,
}: {
  activeTab: NucleusDetailTab
  context: AccessibleNucleusContext
  payload: Payload
  searchParams: NucleusDetailSearchParams
  user: CampaignUser
  view: NucleusDetailViewModel
}) => {
  const data = await loadNucleusActiveTabPageData(
    payload,
    user,
    context,
    activeTab,
    searchParams,
  )

  if (data.tab === 'overview') {
    return (
      <OverviewContent
        baseline={data.baseline}
        canEditIntelligence={user.role !== 'lideranca'}
        confirmedVoteEstimate={view.confirmedVoteEstimate}
        context={context}
        nucleus={view.tabs}
        primaryContact={data.primaryContactPageData.current}
        searchParams={searchParams}
        updatePreview={data.updatePreview}
      />
    )
  }

  if (data.tab === 'territory') return <TerritoryContent nucleus={view.tabs} />
  if (data.tab === 'electorate') {
    if (view.tabs.kind !== 'staff') redirect(`/campanha/nucleos/${view.slug}?tab=overview`)
    return <ElectorateContent nucleus={view.tabs} />
  }

  if (data.tab === 'leaderships') {
    const state = parseLeadershipFilterState(searchParams)
    if (
      data.leadershipPageData.totalPages > 0 &&
      (state.page ?? 1) > data.leadershipPageData.totalPages
    ) {
      redirect(
        buildNucleusDetailTabHref(view.slug, 'leaderships', {
          ...searchParams,
          leadershipPage: String(data.leadershipPageData.totalPages),
        }),
      )
    }
    const primaryContactId =
      view.kind === 'staff' && data.leadershipPageData.kind === 'staff'
        ? view.primaryContactId
        : null
    if (
      ((data.panelState.mode === 'view' || data.panelState.mode === 'edit') &&
        !data.selectedLeadership) ||
      (user.role === 'lideranca' &&
        (searchParams.leadership || searchParams.editLeadership || searchParams.newLeadership))
    ) {
      redirect(buildLeadershipPanelHref(view.slug, state, { mode: 'closed' }))
    }

    return (
      <LeadershipNetwork
        nucleusId={view.id}
        nucleusSlug={view.slug}
        pageData={data.leadershipPageData}
        primaryContactId={primaryContactId}
        inviteConsentConfigured={data.inviteConsentState.configured}
        filters={state}
        panelState={data.panelState}
        selectedLeadership={data.selectedLeadership}
      />
    )
  }

  if (data.tab !== 'updates') return null

  const state = parseNucleusUpdateListState(searchParams)
  if (data.updatesPageData.totalPages > 0 && state.page > data.updatesPageData.totalPages) {
    redirect(
      buildNucleusDetailTabHref(view.slug, 'updates', {
        ...searchParams,
        updatePage: String(data.updatesPageData.totalPages),
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NucleusUpdateFormShell
          nucleusId={view.id}
          action={createNucleusUpdateFormAction}
          defaultOpen={searchParams.newUpdate === '1'}
        />
      </div>
      <NucleusUpdateFeed
        nucleusSlug={view.slug}
        pageData={data.updatesPageData}
        rawSearchParams={searchParams}
        now={new Date().toISOString()}
      />
    </div>
  )
}
