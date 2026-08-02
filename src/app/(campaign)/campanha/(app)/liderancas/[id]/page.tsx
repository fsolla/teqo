import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { LeadershipInviteButtons } from '@/components/campaign/invite/LeadershipInviteButtons'
import { LeadershipInternalForm } from '@/components/campaign/leadership/LeadershipInternalForm'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { CampaignQuickActionContextSync } from '@/components/campaign/shell/CampaignQuickActionContextSync'
import { StateDeputyChips } from '@/components/campaign/stateDeputy/StateDeputyChips'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { resolvedPortfolioEntriesById } from '@/lib/municipalityPortfolio'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
  loadStateDeputyOptions,
} from '@/utilities/campaignRelationOptions'
import { loadLeadershipDetail } from '@/utilities/leadership/leadershipData'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { updateLeadershipInternalFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('liderancas')

type LeadershipDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function LeadershipDetailPage({ params }: LeadershipDetailPageProps) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) notFound()

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const leadership = await loadLeadershipDetail(payload, user, Number(id))
  if (!leadership) notFound()

  const [municipalityOptions, organizationOptions, stateDeputyOptions, municipalityIndex] =
    await Promise.all([
      loadMunicipalityOptions(payload, user),
      loadOrganizationOptions(payload, user),
      loadStateDeputyOptions(payload, user),
      loadMunicipalityPortfolioIndex(),
    ])

  const municipalityById = resolvedPortfolioEntriesById(municipalityIndex)
  const municipalitySlugs = leadership.municipalityIDs
    .map((id) => municipalityById.get(id)?.slug)
    .filter((slug): slug is string => slug !== undefined)
  const singleMunicipalitySlug = municipalitySlugs.length === 1 ? municipalitySlugs[0] : undefined

  return (
    <CampaignPageShell>
      <CampaignQuickActionContextSync
        leadershipId={leadership.id}
        municipalitySlug={singleMunicipalitySlug}
      />
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/liderancas">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para lideranças
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{leadership.name}</h1>
          {leadership.supportStatus ? (
            <SupportStatusBadge status={leadership.supportStatus} />
          ) : null}
          <Badge variant={leadership.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
            {leadership.hasAppAccess ? 'Com acesso ao app' : 'Sem acesso ao app'}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          {leadership.phone ? `Celular ${leadership.phone}` : 'Sem celular registrado'}
          {leadership.email ? ` · ${leadership.email}` : ''}
        </p>
        {leadership.stateDeputies.length > 0 ? (
          <StateDeputyChips deputies={leadership.stateDeputies} />
        ) : null}
      </header>

      <section
        aria-labelledby="leadership-invites-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="leadership-invites-title" className="text-base font-medium">
            Convites pelo WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            O convite de acesso ao app exige status engajado. Links são de uso único.
          </p>
        </div>
        <LeadershipInviteButtons
          leadershipID={leadership.id}
          canInviteLogin={leadership.supportStatus === 'engajado'}
        />
      </section>

      <section aria-labelledby="leadership-internal-title" className="flex flex-col gap-3">
        <h2 id="leadership-internal-title" className="text-base font-medium">
          Ficha interna
        </h2>
        <LeadershipInternalForm
          leadership={leadership}
          municipalityOptions={municipalityOptions}
          organizationOptions={organizationOptions}
          stateDeputyOptions={stateDeputyOptions}
          formAction={updateLeadershipInternalFormAction}
        />
      </section>
    </CampaignPageShell>
  )
}
