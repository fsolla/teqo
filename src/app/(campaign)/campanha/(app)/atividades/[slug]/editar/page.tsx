import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import {
  searchActivityContactOptions,
  searchActivityResponsibleOptionsAction,
} from '@/app/(campaign)/campanha/(app)/atividades/contactSearchActions'
import { updateActivityFormAction } from '@/app/(campaign)/campanha/(app)/atividades/formActions'
import { ActivityForm } from '@/components/campaign/activity/ActivityForm'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { ActivityNotFoundError, getActivityEditPageData } from '@/utilities/activityPageData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadMunicipalityOptions,
  loadOrganizationOptions,
} from '@/utilities/campaignRelationOptions'

type EditActivityPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: EditActivityPageProps) {
  const { slug } = await params
  if (!slug) return campaignPageMetadata({ title: 'Editar atividade' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff', redirectTo: '/campanha/atividades' }),
    getPayload({ config }),
  ])

  try {
    const view = await getActivityEditPageData(payload, user, slug)
    return campaignPageMetadata({ title: `Editar ${view.title}` })
  } catch {
    return campaignPageMetadata({ title: 'Editar atividade' })
  }
}

export default async function EditActivityPage({ params }: EditActivityPageProps) {
  const [{ slug }, user, payload] = await Promise.all([
    params,
    requireCampaignPageActor({ gate: 'staff', redirectTo: '/campanha/atividades' }),
    getPayload({ config }),
  ])
  if (!slug) notFound()

  const [view, municipalityOptions, organizationOptions] = await Promise.all([
    getActivityEditPageData(payload, user, slug).catch((error) => {
      if (error instanceof ActivityNotFoundError) notFound()
      throw error
    }),
    loadMunicipalityOptions(payload, user),
    loadOrganizationOptions(payload, user),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <SetCampaignPageChrome chrome={{ title: `Editar ${view.title}` }} />
      <ActivityForm
        action={updateActivityFormAction}
        activity={view}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        submitLabel="Salvar alterações"
        searchContacts={searchActivityContactOptions}
        searchResponsibles={searchActivityResponsibleOptionsAction}
      />
    </div>
  )
}
