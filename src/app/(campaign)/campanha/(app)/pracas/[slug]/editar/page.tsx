import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { PlazaAdvisorsForm } from '@/components/campaign/PlazaAdvisorsForm'
import { PlazaStrategyForm } from '@/components/campaign/PlazaStrategyForm'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  getPlazaDetailViewModel,
  PlazaNotFoundError,
  resolveAccessiblePlazaContext,
} from '@/utilities/plazaPageData'
import { getEligibleAdvisorOptions } from '@/utilities/plazaViewModels'
import {
  assignPlazaAdvisorsFormAction,
  setPlazaExpectedVotesFormAction,
  setPlazaPoliticalTrendFormAction,
  updatePlazaStrategyFormAction,
} from './formActions'

type PlazaEditPageProps = {
  params: Promise<{ slug: string }>
}

export default async function PlazaEditPage({ params }: PlazaEditPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect(`/campanha/pracas/${slug}`)

  let context
  try {
    context = await resolveAccessiblePlazaContext(payload, user, slug)
  } catch (error) {
    if (error instanceof PlazaNotFoundError) notFound()
    throw error
  }

  const view = await getPlazaDetailViewModel(payload, context, user)
  if (!view.strategy) redirect(`/campanha/pracas/${slug}`)

  const advisorOptions =
    user.role === 'coordinator' ? await getEligibleAdvisorOptions(payload, user) : []

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href={`/campanha/pracas/${view.slug}`}>
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
        <PlazaAdvisorsForm
          plazaID={view.id}
          plazaSlug={view.slug}
          currentAdvisorIDs={view.advisorIDs}
          options={advisorOptions}
          formAction={assignPlazaAdvisorsFormAction}
        />
      ) : null}

      <PlazaStrategyForm
        plazaID={view.id}
        plazaSlug={view.slug}
        strategy={view.strategy}
        strategyFormAction={updatePlazaStrategyFormAction}
        expectedVotesFormAction={setPlazaExpectedVotesFormAction}
        trendFormAction={setPlazaPoliticalTrendFormAction}
      />
    </CampaignPageShell>
  )
}
