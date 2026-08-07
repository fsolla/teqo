import { notFound, redirect } from 'next/navigation'

import { WizardLeadershipStep } from '@/components/campaign/leadership/WizardLeadershipStep'
import { WizardTrendChoiceStep } from '@/components/campaign/municipality/WizardTrendChoiceStep'
import { WizardTrendNoteStep } from '@/components/campaign/municipality/WizardTrendNoteStep'
import { WizardUpdateBodyStep } from '@/components/campaign/municipality/WizardUpdateBodyStep'
import { WizardExpectedVotesStep } from '@/components/campaign/shared/WizardExpectedVotesStep'
import { WizardMunicipalitySearchStep } from '@/components/campaign/shared/WizardMunicipalitySearchStep'
import { WizardMunicipalitySelectedStub } from '@/components/campaign/shared/WizardMunicipalitySelectedStub'
import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  hasWizardScenarioParam,
  isCampaignWizardActionSlug,
  parseWizardEntryActionParam,
  parseWizardLeadershipIdParam,
  parseWizardMunicipioParam,
  parseWizardReturnPath,
  resolveWizardTrendStatusParam,
  WIZARD_ENTRY_ACTION_QUERY_KEY,
  WIZARD_LEADERSHIP_ID_QUERY_KEY,
  WIZARD_MUNICIPIO_QUERY_KEY,
  WIZARD_NOTE_PREFILL_QUERY_KEY,
  WIZARD_RETURN_PATH_QUERY_KEY,
  WIZARD_SCENARIO_QUERY_KEY,
  WIZARD_TREND_STATUS_QUERY_KEY,
  WIZARD_VOTE_FROM_QUERY_KEY,
  WIZARD_VOTE_TO_QUERY_KEY,
  wizardActionHref,
  wizardTrendHref,
} from '@/lib/campaignActionRoutes'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import {
  buildPoliticalTrendNotePrefill,
  resolvePoliticalTrendNotePrefillSource,
  resolveWizardTrendNoteDestination,
} from '@/lib/politicalTrendWizardUi'
import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  isWizardChainActionId,
  wizardChainContinueHref,
  wizardChainEndHref,
} from '@/lib/wizardActionChain'
import config from '@/payload.config'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadWizardLeadershipTiles } from '@/utilities/leadership/leadershipData'
import { loadMunicipalityScope } from '@/utilities/municipality/campaignMunicipalityScope'
import { getPayload } from 'payload'

const politicalTrendWizardPrefillParams = (
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string> | undefined => {
  const keys = [
    WIZARD_NOTE_PREFILL_QUERY_KEY,
    WIZARD_VOTE_FROM_QUERY_KEY,
    WIZARD_VOTE_TO_QUERY_KEY,
  ] as const
  const result: Record<string, string> = {}

  for (const key of keys) {
    const raw = searchParams[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value?.trim()) {
      result[key] = value.trim()
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

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
        previousHref={wizardChainEndHref(returnPath)}
        returnPath={returnPath}
        accessibleMunicipalities={accessibleMunicipalities}
      />
    )
  }

  const needsPoliticalTrend = slug === CAMPAIGN_WIZARD_ACTION_SLUGS['change-trend']
  const user = await requireCampaignPageActor()
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

    const entryAction = parseWizardEntryActionParam(
      resolvedSearchParams[WIZARD_ENTRY_ACTION_QUERY_KEY],
    )

    return (
      <WizardExpectedVotesStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        initialExpectedVotes={toVoteEstimateScenarioViewModel(municipality.expectedVotes)}
        entryAction={entryAction}
        returnPath={returnPath}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['update-leadership']) {
    const entryAction = parseWizardEntryActionParam(
      resolvedSearchParams[WIZARD_ENTRY_ACTION_QUERY_KEY],
    )
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
        entryAction={entryAction}
        initialTiles={tiles}
        initialLeadershipId={initialLeadershipId}
        returnPath={returnPath}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['change-trend']) {
    const entryAction = parseWizardEntryActionParam(
      resolvedSearchParams[WIZARD_ENTRY_ACTION_QUERY_KEY],
    )
    const prefillExtraParams = politicalTrendWizardPrefillParams(resolvedSearchParams)
    const prefillSource = resolvePoliticalTrendNotePrefillSource({
      entryAction,
      notePrefill: resolvedSearchParams[WIZARD_NOTE_PREFILL_QUERY_KEY],
      voteFrom: resolvedSearchParams[WIZARD_VOTE_FROM_QUERY_KEY],
      voteTo: resolvedSearchParams[WIZARD_VOTE_TO_QUERY_KEY],
    })
    const initialNote = buildPoliticalTrendNotePrefill(prefillSource)
    const currentStatus = municipality.politicalTrend?.status ?? null
    const { trendStatus, invalid } = resolveWizardTrendStatusParam(
      resolvedSearchParams[WIZARD_TREND_STATUS_QUERY_KEY],
    )

    if (invalid) {
      redirect(wizardTrendHref(slug, municipalitySlug, undefined, entryAction, prefillExtraParams))
    }

    if (trendStatus) {
      const noteDestination = resolveWizardTrendNoteDestination(trendStatus, currentStatus)

      if (noteDestination === 'home') {
        // Chained session: advance the queue (B98). Standalone stale deep-link: Início (B97).
        if (isWizardChainActionId(entryAction)) {
          redirect(
            wizardChainContinueHref(entryAction, 'change-trend', municipalitySlug, returnPath),
          )
        }
        redirect(wizardChainEndHref(returnPath))
      }

      if (noteDestination === 'choice') {
        redirect(
          wizardTrendHref(slug, municipalitySlug, undefined, entryAction, prefillExtraParams),
        )
      }

      return (
        <WizardTrendNoteStep
          actionSlug={slug}
          municipalityId={municipality.id}
          municipalityName={municipality.name}
          municipalitySlug={municipality.slug}
          trendStatus={trendStatus}
          initialNote={initialNote}
          entryAction={entryAction}
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
        entryAction={entryAction}
        prefillExtraParams={prefillExtraParams}
        returnPath={returnPath}
      />
    )
  }

  if (slug === CAMPAIGN_WIZARD_ACTION_SLUGS['register-update']) {
    const entryAction = parseWizardEntryActionParam(
      resolvedSearchParams[WIZARD_ENTRY_ACTION_QUERY_KEY],
    )

    return (
      <WizardUpdateBodyStep
        actionSlug={slug}
        municipalityId={municipality.id}
        municipalityName={municipality.name}
        municipalitySlug={municipality.slug}
        entryAction={entryAction}
        returnPath={returnPath}
        isStaff={isStaffCampaignRole(user.role)}
      />
    )
  }

  return (
    <WizardMunicipalitySelectedStub
      actionSlug={slug}
      municipalityName={municipality.name}
      returnPath={returnPath}
    />
  )
}
