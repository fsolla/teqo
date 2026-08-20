import { notFound, redirect } from 'next/navigation'

import { WizardLeadershipStep } from '@/components/campaign/leadership/WizardLeadershipStep'
import { WizardTrendChoiceStep } from '@/components/campaign/municipality/WizardTrendChoiceStep'
import { WizardTrendNoteStep } from '@/components/campaign/municipality/WizardTrendNoteStep'
import { WizardUpdateBodyStep } from '@/components/campaign/municipality/WizardUpdateBodyStep'
import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'
import { WizardMunicipalitySearchStep } from '@/components/campaign/shared/WizardMunicipalitySearchStep'
import { WizardRegisterDemandStep } from '@/components/campaign/shared/WizardRegisterDemandStep'
import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  hasWizardScenarioParam,
  isCampaignWizardActionSlug,
  parseWizardLeadershipIdParam,
  parseWizardMunicipioParam,
  parseWizardReturnPath,
  resolveWizardTrendStatusParam,
  WIZARD_LEADERSHIP_ID_QUERY_KEY,
  WIZARD_MUNICIPIO_QUERY_KEY,
  WIZARD_RETURN_PATH_QUERY_KEY,
  WIZARD_SCENARIO_QUERY_KEY,
  WIZARD_TREND_STATUS_QUERY_KEY,
  wizardActionHref,
  wizardReturnHref,
  wizardTrendHref,
} from '@/lib/campaignActionRoutes'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { resolveWizardTrendNoteDestination } from '@/lib/politicalTrendWizardUi'
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
  const returnPath = parseWizardReturnPath(resolvedSearchParams[WIZARD_RETURN_PATH_QUERY_KEY])

  if (!isCampaignWizardActionSlug(slug)) {
    notFound()
  }

  const municipalitySlug = parseWizardMunicipioParam(
    resolvedSearchParams[WIZARD_MUNICIPIO_QUERY_KEY],
  )
  if (!municipalitySlug) {
    const user = await requireCampaignPageActor()
    const payload = await getPayload({ config: await config })
    const { municipalities } = await loadMunicipalityScope(payload, user, {})
    const accessibleMunicipalities = municipalities.map(({ slug, name, ibgeCode }) => ({
      slug,
      name,
      ibgeCode,
    }))

    return (
      <WizardMunicipalitySearchStep
        actionSlug={slug}
        previousHref={wizardReturnHref(returnPath)}
        returnPath={returnPath}
        accessibleMunicipalities={accessibleMunicipalities}
      />
    )
  }

  const needsPoliticalTrend = slug === CAMPAIGN_WIZARD_ACTION_SLUGS['change-trend']
  // Demands are staff-only (A5): gate before the municipality scope loads,
  // so a leader gets the standard contacts-home redirect (B43) instead of a
  // 403/404 — deterministic in dev and production alike.
  const user = await requireCampaignPageActor(
    slug === CAMPAIGN_WIZARD_ACTION_SLUGS['register-demand'] ? { gate: 'staff' } : undefined,
  )
  const payload = await getPayload({ config: await config })
  const { municipalities } = await loadMunicipalityScope(
    payload,
    user,
    { slug: { equals: municipalitySlug } },
    needsPoliticalTrend ? { extraSelect: { politicalTrend: true } } : undefined,
  )

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
        municipalitySlug={municipality.slug}
        initialExpectedVotes={toVoteEstimateScenarioViewModel(municipality.expectedVotes)}
        returnPath={returnPath}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-leadership']) {
    const initialLeadershipId = parseWizardLeadershipIdParam(
      resolvedSearchParams[WIZARD_LEADERSHIP_ID_QUERY_KEY],
    )
    const tiles = await loadWizardLeadershipTiles(payload, user, municipality.id)

    return (
      <WizardLeadershipStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        initialTiles={tiles}
        initialLeadershipId={initialLeadershipId}
        returnPath={returnPath}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['change-trend']) {
    const currentStatus = municipality.politicalTrend?.status ?? null
    const { trendStatus, invalid } = resolveWizardTrendStatusParam(
      resolvedSearchParams[WIZARD_TREND_STATUS_QUERY_KEY],
    )

    if (invalid) {
      redirect(wizardTrendHref(slug, municipalitySlug))
    }

    if (trendStatus) {
      const noteDestination = resolveWizardTrendNoteDestination(trendStatus, currentStatus)

      // Post-save RSC refresh (status already matches) lands in 'home': render
      // the note step and let the client own the toast + return navigation
      // (B97 / B168) — a server redirect here would swallow the toast. The
      // choice tiles only ever link selectable (≠ current) statuses, so a fresh
      // deep-link cannot realistically reach 'home'.
      if (noteDestination === 'choice') {
        redirect(wizardTrendHref(slug, municipalitySlug))
      }

      return (
        <WizardTrendNoteStep
          actionSlug={slug}
          municipalityId={municipality.id}
          municipalityName={municipality.name}
          municipalitySlug={municipality.slug}
          trendStatus={trendStatus}
          returnPath={returnPath}
        />
      )
    }

    return (
      <WizardTrendChoiceStep
        actionSlug={slug}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        currentStatus={currentStatus}
        returnPath={returnPath}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['register-update']) {
    return (
      <WizardUpdateBodyStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        returnPath={returnPath}
        isStaff={isStaffCampaignRole(user.role)}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['register-demand']) {
    return (
      <WizardRegisterDemandStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        returnPath={returnPath}
        currentUser={{ id: user.id, name: user.name }}
      />
    )
  }

  notFound()
}
