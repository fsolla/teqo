import { notFound, redirect } from 'next/navigation'

import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'
import { WizardMunicipalitySearchStep } from '@/components/campaign/shared/WizardMunicipalitySearchStep'
import { WizardMunicipalitySelectedStub } from '@/components/campaign/shared/WizardMunicipalitySelectedStub'
import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  hasWizardScenarioParam,
  isCampaignWizardActionSlug,
  parseWizardMunicipioParam,
  WIZARD_MUNICIPIO_QUERY_KEY,
  WIZARD_SCENARIO_QUERY_KEY,
  wizardActionHref,
} from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import config from '@/payload.config'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import { getPayload } from 'payload'

type CampaignActionWizardPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export function generateStaticParams() {
  return Object.values(CAMPAIGN_WIZARD_ACTION_SLUGS).map((slug) => ({ slug }))
}

export default async function CampaignActionWizardPage({
  params,
  searchParams,
}: CampaignActionWizardPageProps) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams

  if (!isCampaignWizardActionSlug(slug)) {
    notFound()
  }

  const municipalitySlug = parseWizardMunicipioParam(
    resolvedSearchParams[WIZARD_MUNICIPIO_QUERY_KEY],
  )
  if (!municipalitySlug) {
    return <WizardMunicipalitySearchStep actionSlug={slug} previousHref={CAMPAIGN_HOME} />
  }

  const user = await requireCampaignPageActor()
  const payload = await getPayload({ config: await config })
  const { municipalities } = await loadMunicipalityScope(payload, user, {
    slug: { equals: municipalitySlug },
  })

  const municipality = municipalities[0]
  if (!municipality || municipality.slug !== municipalitySlug) {
    notFound()
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']) {
    if (hasWizardScenarioParam(resolvedSearchParams[WIZARD_SCENARIO_QUERY_KEY])) {
      redirect(wizardActionHref(slug, municipalitySlug))
    }

    return (
      <WizardExpectedVotesStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        initialExpectedVotes={toVoteEstimateScenarioViewModel(municipality.expectedVotes)}
      />
    )
  }

  return <WizardMunicipalitySelectedStub actionSlug={slug} municipalityName={municipality.name} />
}
