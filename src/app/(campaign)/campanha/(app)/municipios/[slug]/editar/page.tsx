import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { MunicipalityAdvisorsForm } from '@/components/campaign/municipality/MunicipalityAdvisorsForm'
import { MunicipalityStrategyForm } from '@/components/campaign/municipality/MunicipalityStrategyForm'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import {
  getMunicipalityDetailViewModel,
  MunicipalityNotFoundError,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipalityPageData'
import { getEligibleAdvisorOptions } from '@/utilities/municipalityViewModels'
import {
  assignMunicipalityAdvisorsFormAction,
  setMunicipalityExpectedVotesFormAction,
  setMunicipalityPoliticalTrendFormAction,
} from '../../municipalityStaffFormActions'
import { updateMunicipalityStrategyFormAction } from './formActions'

type MunicipalityEditPageProps = {
  params: Promise<{ slug: string }>
}

export default async function MunicipalityEditPage({ params }: MunicipalityEditPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect(`/campanha/municipios/${slug}`)

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
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href={`/campanha/municipios/${view.slug}`}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para {view.name}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Editar {view.name}</h1>
        <p className="text-muted-foreground">
          A geografia da Praça é pré-definida e não pode ser alterada. Aqui você edita metas,
          votos estimados, inteligência e tendência política.
        </p>
      </header>

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
