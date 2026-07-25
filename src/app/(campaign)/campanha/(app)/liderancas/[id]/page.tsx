import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { LeadershipInternalForm } from '@/components/campaign/leadership/LeadershipInternalForm'
import { LeadershipInviteButtons } from '@/components/campaign/invite/LeadershipInviteButtons'
import { StateDeputyChips } from '@/components/campaign/stateDeputy/StateDeputyChips'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadOrganizationOptions, loadMunicipalityOptions, loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import { loadLeadershipDetail } from '@/utilities/leadershipData'
import { updateLeadershipInternalFormAction } from './formActions'

type LeadershipDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function LeadershipDetailPage({ params }: LeadershipDetailPageProps) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) notFound()

  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const leadership = await loadLeadershipDetail(payload, user, Number(id))
  if (!leadership) notFound()

  const [municipalityOptions, organizationOptions, stateDeputyOptions] = await Promise.all([
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
    loadStateDeputyOptions(payload, user),
  ])

  return (
    <CampaignPageShell>
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
