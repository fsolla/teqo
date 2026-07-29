import { CampaignHomeActions } from '@/components/campaign/dashboard/CampaignHomeActions'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignHomeStaffChrome } from '@/components/campaign/dashboard/CampaignHomeStaffChrome'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildMunicipalityListHref } from '@/utilities/municipality/municipalityListUrl'

export const dynamic = 'force-dynamic'

export default async function CampaignHomePage() {
  const user = await requireCampaignPageActor()

  const staff = isStaffCampaignRole(user.role)

  const uncoveredMunicipalitiesHref = staff
    ? buildMunicipalityListHref({ page: 1, coverage: 'sem_assessor', sort: 'votos' }, 1)
    : undefined

  const actions = (
    <CampaignHomeActions
      role={user.role}
      uncoveredMunicipalitiesHref={uncoveredMunicipalitiesHref}
    />
  )

  return (
    <CampaignPageShell aria-label="Início" className="min-h-full">
      {staff ? (
        <CampaignHomeStaffChrome actions={actions} />
      ) : (
        <CampaignHomeLayout actions={actions} />
      )}
    </CampaignPageShell>
  )
}
