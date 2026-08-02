import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { MunicipalityAdvisorsForm } from '@/components/campaign/municipality/MunicipalityAdvisorsForm'
import { MunicipalityStrategyForm } from '@/components/campaign/municipality/MunicipalityStrategyForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { Button } from '@/components/ui/button'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import {
  getMunicipalityDetailViewModel,
  MunicipalityNotFoundError,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import { getEligibleAdvisorOptions } from '@/utilities/municipality/municipalityViewModels'
import {
  assignMunicipalityAdvisorsFormAction,
  setMunicipalityExpectedVotesFormAction,
  setMunicipalityPoliticalTrendFormAction,
} from '../../municipalityStaffFormActions'
import { updateMunicipalityStrategyFormAction } from './formActions'

type MunicipalityEditPageProps = {
  params: Promise<{ slug: string }>
}

const municipalityEditSubtitle =
  'A geografia do município é pré-definida e não pode ser alterada. Aqui você edita metas, votos estimados, inteligência e tendência política.'

export async function generateMetadata({ params }: MunicipalityEditPageProps) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const user = await requireCampaignPageActor({ gate: 'staff', redirectTo: `/campanha/municipios/${slug}` })

  try {
    const context = await resolveAccessibleMunicipalityContext(payload, user, slug)
    const view = await getMunicipalityDetailViewModel(payload, context, user)
    return campaignPageMetadata({ title: `Editar ${view.name}`, subtitle: municipalityEditSubtitle })
  } catch {
    return campaignPageMetadata({ title: 'Editar município', subtitle: municipalityEditSubtitle })
  }
}

export default async function MunicipalityEditPage({ params }: MunicipalityEditPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff', redirectTo: `/campanha/municipios/${slug}` }),
    getPayload({ config }),
  ])

  let context
  try {
    context = await resolveAccessibleMunicipalityContext(payload, user, slug)
  } catch (error) {
    if (error instanceof MunicipalityNotFoundError) notFound()
    throw error
  }

  const view = await getMunicipalityDetailViewModel(payload, context, user)
  if (!view.strategy) redirect(`/campanha/municipios/${slug}`)

  const advisorOptions =
    user.role === 'coordinator' ? await getEligibleAdvisorOptions(payload, user) : []
  const stateDeputyOptions = await loadStateDeputyOptions(payload, user)

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome
        chrome={{ title: `Editar ${view.name}`, subtitle: municipalityEditSubtitle }}
      />
      <Button asChild variant="ghost" className="min-h-11 self-start">
        <Link href={`/campanha/municipios/${view.slug}`}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Voltar para {view.name}
        </Link>
      </Button>

      {user.role === 'coordinator' ? (
        <MunicipalityAdvisorsForm
          municipalityID={view.id}
          municipalitySlug={view.slug}
          currentAdvisorIDs={view.advisorIDs}
          options={advisorOptions}
          formAction={assignMunicipalityAdvisorsFormAction}
        />
      ) : null}

      <MunicipalityStrategyForm
        municipalityID={view.id}
        municipalitySlug={view.slug}
        strategy={view.strategy}
        stateDeputyOptions={stateDeputyOptions}
        strategyFormAction={updateMunicipalityStrategyFormAction}
        expectedVotesFormAction={setMunicipalityExpectedVotesFormAction}
        trendFormAction={setMunicipalityPoliticalTrendFormAction}
      />
    </CampaignPageShell>
  )
}
