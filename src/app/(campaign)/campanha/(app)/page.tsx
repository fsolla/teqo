import { CampaignHomeActions } from '@/components/campaign/dashboard/CampaignHomeActions'
import { CampaignHomeLayout } from '@/components/campaign/dashboard/CampaignHomeLayout'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildMunicipalityListHref } from '@/utilities/municipality/municipalityListUrl'

export const dynamic = 'force-dynamic'

export default async function CampaignHomePage() {
  const user = await requireCampaignPageActor()

  const uncoveredMunicipalitiesHref = isStaffCampaignRole(user.role)
    ? buildMunicipalityListHref({ page: 1, coverage: 'sem_assessor', sort: 'votos' }, 1)
    : undefined

  return (
    <CampaignPageShell aria-label="Início" className="min-h-full">
      <CampaignHomeLayout
        actions={
          <CampaignHomeActions
            role={user.role}
            uncoveredMunicipalitiesHref={uncoveredMunicipalitiesHref}
          />
        }
      />
    </CampaignPageShell>
  )
}
