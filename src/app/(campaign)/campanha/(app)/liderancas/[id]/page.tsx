import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { LeadershipInviteButtons } from '@/components/campaign/invite/LeadershipInviteButtons'
import { LeadershipAdvisorRelationCell } from '@/components/campaign/leadership/LeadershipAdvisorRelationCell'
import { LeadershipContactSection } from '@/components/campaign/leadership/LeadershipContactSection'
import { LeadershipInternalForm } from '@/components/campaign/leadership/LeadershipInternalForm'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { CampaignQuickActionContextSync } from '@/components/campaign/shell/CampaignQuickActionContextSync'
import { StateDeputyChips } from '@/components/campaign/stateDeputy/StateDeputyChips'
import { Badge } from '@/components/ui/Badge'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { resolvedPortfolioEntriesById } from '@/lib/municipalityPortfolio'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadEligibleAdvisorOptions,
  loadMunicipalityOptions,
  loadOrganizationOptions,
  loadStateDeputyOptions,
} from '@/utilities/campaignRelationOptions'
import { loadLeadershipDetail } from '@/utilities/leadership/leadershipData'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { UserCogIcon } from 'lucide-react'
import {
  setLeadershipAdvisorMembershipFormAction,
  updateLeadershipInternalFormAction,
} from './formActions'

export async function generateMetadata({ params }: LeadershipDetailPageProps) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) return campaignPageMetadata({ title: 'Liderança' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const leadership = await loadLeadershipDetail(payload, user, Number(id))
  if (!leadership) return campaignPageMetadata({ title: 'Liderança' })

  return campaignPageMetadata({ title: 'Liderança', subtitle: leadership.name })
}

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

  // C99 — only coordinator/candidate assign leadership advisors; the rest of
  // staff reads (same gate as the dobradinha section, B156).
  const canEditAdvisors = isCampaignUnrestricted(user)
  const advisorOptions = canEditAdvisors ? await loadEligibleAdvisorOptions(payload, user) : []

  const municipalityById = resolvedPortfolioEntriesById(municipalityIndex)
  const municipalitySlugs = leadership.municipalityIDs
    .map((id) => municipalityById.get(id)?.slug)
    .filter((slug): slug is string => slug !== undefined)
  const singleMunicipalitySlug = municipalitySlugs.length === 1 ? municipalitySlugs[0] : undefined

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome chrome={{ title: 'Liderança', subtitle: leadership.name }} />
      <CampaignQuickActionContextSync
        leadershipId={leadership.id}
        municipalitySlug={singleMunicipalitySlug}
      />
      <div className="flex flex-wrap items-center gap-2">
        {leadership.supportStatus ? <SupportStatusBadge status={leadership.supportStatus} /> : null}
        <Badge variant={leadership.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
          {leadership.hasAppAccess ? 'Com acesso ao app' : 'Sem acesso ao app'}
        </Badge>
      </div>
      <LeadershipContactSection
        leadershipId={leadership.id}
        name={leadership.name}
        email={leadership.email}
        phones={leadership.phones}
      />
      {leadership.stateDeputies.length > 0 ? (
        <StateDeputyChips deputies={leadership.stateDeputies} />
      ) : null}

      <section
        aria-labelledby="leadership-advisors-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex items-center gap-2">
          <UserCogIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="leadership-advisors-title" className="text-base font-medium">
            Assessores responsáveis
          </h2>
          <Badge variant="outline">{leadership.advisors.length}</Badge>
        </div>
        <LeadershipAdvisorRelationCell
          leadershipId={leadership.id}
          leadershipName={leadership.name}
          advisors={leadership.advisors}
          options={
            canEditAdvisors
              ? advisorOptions.map((option) => ({
                  id: option.id,
                  searchLabel: option.name,
                  item: {
                    id: option.id,
                    label: option.name,
                    href: `/campanha/assessores/${option.id}`,
                  },
                }))
              : []
          }
          membershipAction={setLeadershipAdvisorMembershipFormAction}
          readOnly={!canEditAdvisors}
        />
      </section>

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
