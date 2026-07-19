import config from '@payload-config'
import { PencilIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { Suspense } from 'react'

import {
  assignNucleusCoordinatorsFormAction,
  loadCoordinatorAssignmentOptions,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/coordinatorAssignmentFormActions'
import { loadNucleusShareRecipients } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/shareRecipientsActions'
import { confirmVoteEstimateFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/voteEstimateFormActions'
import { ArchiveNucleusDialog } from '@/components/campaign/ArchiveNucleusDialog'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { CoordinatorAssignmentCard } from '@/components/campaign/CoordinatorAssignmentCard'
import { CoordinatorAssignmentDialog } from '@/components/campaign/CoordinatorAssignmentDialog'
import { NucleusActiveTab, NucleusActiveTabLoading } from '@/components/campaign/NucleusActiveTab'
import { NucleusTabNav } from '@/components/campaign/NucleusTabNav'
import { RecentVisitTracker } from '@/components/campaign/RecentVisitTracker'
import { ShareNucleusDialogShell } from '@/components/campaign/ShareNucleusDialogShell'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { VoteEstimateCard } from '@/components/campaign/VoteEstimateCard'
import { VoteEstimateDialogShell } from '@/components/campaign/VoteEstimateDialogShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  buildLeadershipPanelHref,
  nucleusDetailFocusFallbackId,
  parseLeadershipFilterState,
} from '@/utilities/leadershipUi'
import { loadNucleusDetailPageData } from '@/utilities/nucleusDetailPageData'
import {
  getNucleusDetailTabRedirect,
  resolveNucleusDetailTab,
} from '@/utilities/nucleusDetailTabUi'
import { NucleusNotFoundError } from '@/utilities/nucleusPageData'
import { formatNucleusTerritoryLabel, organizationKindLabels } from '@/utilities/nucleusUi'

type NucleusDetailPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const detailScopeLabels = {
  geral: 'Visível para você · Coordenação geral',
  coordenador: 'Visível para você · Coordenador',
  lideranca: 'Visível para você · Liderança',
} as const

export default async function NucleusDetailPage({ params, searchParams }: NucleusDetailPageProps) {
  const [{ slug }, query, user, payload] = await Promise.all([
    params,
    searchParams,
    getCampaignUser(),
    getPayload({ config }),
  ])

  if (!user) redirect('/campanha/login')

  if (!slug) notFound()
  const nucleusKind = user.role === 'lideranca' ? 'leadership' : 'staff'
  const activeTab = resolveNucleusDetailTab(query, nucleusKind)
  const { context, view, coordinatorAssignment } = await loadNucleusDetailPageData(
    payload,
    user,
    slug,
    activeTab,
  ).catch((error) => {
    if (error instanceof NucleusNotFoundError) notFound()
    throw error
  })
  const canonicalTabRedirect = getNucleusDetailTabRedirect(view.slug, query, view.kind)
  if (canonicalTabRedirect) redirect(canonicalTabRedirect)

  const leadershipFilters = parseLeadershipFilterState(query)
  const canEdit = user.role === 'geral' || user.role === 'coordenador'
  const isStaffView = view.kind === 'staff'
  const confirmVoteEstimateAction = confirmVoteEstimateFormAction.bind(
    null,
    isStaffView ? view.proposedVoteEstimateVersion : null,
  )
  const territory = formatNucleusTerritoryLabel(view)
  const voteEstimateFocusTargetId = `vote-estimate-${view.id}-focus-target`

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <CampaignScopeBadge>{detailScopeLabels[user.role]}</CampaignScopeBadge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id={nucleusDetailFocusFallbackId}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight focus-visible:outline-none"
              >
                {view.name}
              </h1>
              {view.status === 'arquivado' ? <Badge variant="secondary">Arquivado</Badge> : null}
            </div>
            <span className="block text-muted-foreground">
              {view.organizationLabel ?? organizationKindLabels[view.organizationKind]}
              {' · '}
              {territory}
            </span>
            <div className="flex flex-wrap gap-1">
              {view.tseZones.length ? (
                view.tseZones.map((zoneNumber) => (
                  <TseZoneBadge key={zoneNumber} zoneNumber={zoneNumber} />
                ))
              ) : (
                <Badge variant="tse">Sem Zona TSE</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareNucleusDialogShell
              loadRecipients={loadNucleusShareRecipients.bind(null, view.slug)}
              nucleusName={view.name}
              senderName={user.name}
            />
            {canEdit ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/campanha/nucleos/${view.slug}/editar`}>
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            ) : null}
            {user.role !== 'lideranca' ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link
                  href={buildLeadershipPanelHref(view.slug, leadershipFilters, { mode: 'create' })}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  Nova liderança
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/campanha/nucleos/${view.slug}?tab=updates&newUpdate=1`}>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Nova atualização
              </Link>
            </Button>
            {user.role === 'geral' && view.status === 'ativo' ? (
              <ArchiveNucleusDialog nucleusId={view.id} />
            ) : null}
          </div>
        </div>
      </header>

      <section
        aria-label="Resumo operacional"
        className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-2 *:min-w-0"
      >
        <CoordinatorAssignmentCard coordinators={coordinatorAssignment.coordinators}>
          {coordinatorAssignment.canManage ? (
            <CoordinatorAssignmentDialog
              coordinators={coordinatorAssignment.coordinators}
              action={assignNucleusCoordinatorsFormAction.bind(null, view.slug)}
              loadOptions={loadCoordinatorAssignmentOptions.bind(null, view.slug)}
              initialOpen={query.assignCoordinators === '1'}
            />
          ) : null}
        </CoordinatorAssignmentCard>

        <VoteEstimateCard
          focusTargetId={voteEstimateFocusTargetId}
          confirmedEstimate={view.confirmedVoteEstimate}
          confirmedBy={isStaffView ? (view.confirmedVoteEstimateBy ?? undefined) : undefined}
          confirmedAt={
            isStaffView && view.confirmedVoteEstimateAt
              ? new Intl.DateTimeFormat('pt-BR').format(new Date(view.confirmedVoteEstimateAt))
              : undefined
          }
          proposedEstimate={isStaffView ? view.proposedVoteEstimate : null}
          proposedBy={isStaffView ? (view.proposedVoteEstimateBy ?? undefined) : undefined}
          proposedAt={
            isStaffView && view.proposedVoteEstimateAt
              ? new Intl.DateTimeFormat('pt-BR').format(new Date(view.proposedVoteEstimateAt))
              : undefined
          }
          action={
            <VoteEstimateDialogShell
              key={`${view.confirmedVoteEstimate ?? 'none'}-${isStaffView ? (view.proposedVoteEstimateVersion ?? 'none') : 'private'}`}
              nucleusId={view.id}
              role={user.role}
              confirmedEstimate={view.confirmedVoteEstimate}
              confirmedEstimateRevision={isStaffView ? view.confirmedVoteEstimateAt : null}
              fallbackFocusId={voteEstimateFocusTargetId}
              proposedEstimate={isStaffView ? view.proposedVoteEstimate : null}
              confirmAction={confirmVoteEstimateAction}
            />
          }
        />
      </section>

      <NucleusTabNav
        activeTab={activeTab}
        nucleusKind={view.kind}
        nucleusSlug={view.slug}
        searchParams={query}
      />
      <Suspense fallback={<NucleusActiveTabLoading />}>
        <NucleusActiveTab
          activeTab={activeTab}
          context={context}
          payload={payload}
          searchParams={query}
          user={user}
          view={view}
        />
      </Suspense>
      <RecentVisitTracker
        entry={{
          href: `/campanha/nucleos/${view.slug}`,
          label: view.name,
          kind: 'nucleus',
        }}
      />
    </div>
  )
}
