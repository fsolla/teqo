import { notFound, redirect } from 'next/navigation'

import { WizardLeadershipStep } from '@/components/campaign/leadership/WizardLeadershipStep'
import { WizardSignalBodyStep } from '@/components/campaign/municipality/WizardSignalBodyStep'
import { WizardSignalTypeStep } from '@/components/campaign/municipality/WizardSignalTypeStep'
import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'
import { WizardMunicipalitySearchStep } from '@/components/campaign/shared/WizardMunicipalitySearchStep'
import { WizardMunicipalitySelectedStub } from '@/components/campaign/shared/WizardMunicipalitySelectedStub'
import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  hasWizardScenarioParam,
  isCampaignWizardActionSlug,
  parseWizardEntryActionParam,
  parseWizardMunicipioParam,
  resolveWizardSignalTypeParam,
  WIZARD_ENTRY_ACTION_QUERY_KEY,
  WIZARD_MUNICIPIO_QUERY_KEY,
  WIZARD_SCENARIO_QUERY_KEY,
  WIZARD_SIGNAL_TYPE_QUERY_KEY,
  wizardActionHref,
  wizardSignalHref,
} from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import config from '@/payload.config'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadWizardLeadershipTiles } from '@/utilities/leadership/leadershipData'
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

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-leadership']) {
    const entryAction = parseWizardEntryActionParam(
      resolvedSearchParams[WIZARD_ENTRY_ACTION_QUERY_KEY],
    )
    const tiles = await loadWizardLeadershipTiles(payload, user, municipality.id)

    return (
      <WizardLeadershipStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        entryAction={entryAction}
        initialTiles={tiles}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['register-signal']) {
    const entryAction = parseWizardEntryActionParam(
      resolvedSearchParams[WIZARD_ENTRY_ACTION_QUERY_KEY],
    )
    const { signalType, invalid } = resolveWizardSignalTypeParam(
      resolvedSearchParams[WIZARD_SIGNAL_TYPE_QUERY_KEY],
    )

    if (invalid) {
      redirect(wizardSignalHref(slug, municipalitySlug, undefined, entryAction))
    }

    if (signalType) {
      return (
        <WizardSignalBodyStep
          actionSlug={slug}
          municipalityId={municipality.id}
          municipalityName={municipality.name}
          municipalitySlug={municipality.slug}
          signalType={signalType}
          entryAction={entryAction}
        />
      )
    }

    return (
      <WizardSignalTypeStep
        actionSlug={slug}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        entryAction={entryAction}
      />
    )
  }

  return <WizardMunicipalitySelectedStub actionSlug={slug} municipalityName={municipality.name} />
}
