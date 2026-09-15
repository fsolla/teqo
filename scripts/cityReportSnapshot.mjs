/**
 * Snapshot composer for the city report (C163).
 *
 * Runs on the homeserver against production, read-only: composes the same
 * loaders the `/campanha` detail/dossier use (no parallel source of truth),
 * projects out PII and fields the report does not need, and returns plain
 * JSON. The render step never touches the database again.
 *
 * Integration layer, not a pure lib: it imports Payload-coupled utilities and
 * is exercised by `tests/int/cityReportSnapshot.int.spec.ts`.
 */

import { getMunicipalityVoteRank } from '../src/lib/municipalityVoteRank.ts'
import { campaignRoleLabels } from '../src/utilities/campaignUserProfile.ts'
import { loadMunicipalityDossierData } from '../src/utilities/municipality/municipalityDossierData.ts'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '../src/utilities/municipality/municipalityPageData.ts'
import { loadAdvisorSummaries } from '../src/utilities/municipality/municipalityViewModels.ts'
import { buildSpeechListWhere } from '../src/utilities/speech/speechListFilters.ts'
import { loadSegmentsForSpeeches } from '../src/utilities/speech/speechPageData.ts'

const SPEECH_LIMIT = 10
const DEMAND_LIMIT = 20

const projectActivity = (activity) => ({
  id: activity.id,
  title: activity.title,
  status: activity.status,
  startAt: activity.startAt,
  locality: activity.locality,
})

const loadSpeeches = async (payload, actor, municipalityID) => {
  const result = await payload.find({
    collection: 'speech',
    where: buildSpeechListWhere({ page: 1, municipalities: [municipalityID] }),
    depth: 0,
    limit: SPEECH_LIMIT,
    sort: '-speechAt',
    select: {
      speechAt: true,
      phase: true,
      summary: true,
      officialTextUrl: true,
    },
    user: actor,
    overrideAccess: false,
  })
  const segmentsBySpeech = await loadSegmentsForSpeeches(
    payload,
    actor,
    result.docs.map((doc) => doc.id),
  )
  return {
    totalCount: result.totalDocs,
    rows: result.docs.map((doc) => {
      const first = (segmentsBySpeech.get(doc.id) ?? [])[0]
      return {
        id: doc.id,
        speechAt: doc.speechAt ?? null,
        phase: doc.phase ?? null,
        officialTextUrl: doc.officialTextUrl ?? null,
        excerpt: first?.text ?? doc.summary ?? null,
      }
    }),
  }
}

const loadDemands = async (payload, actor, municipalityID) => {
  const result = await payload.find({
    collection: 'campaignDemand',
    where: { municipality: { equals: municipalityID } },
    depth: 0,
    limit: DEMAND_LIMIT,
    sort: '-updatedAt',
    select: { title: true, kind: true, status: true, updatedAt: true },
    user: actor,
    overrideAccess: false,
  })
  return {
    totalCount: result.totalDocs,
    rows: result.docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      status: doc.status,
      updatedAt: doc.updatedAt,
    })),
  }
}

/**
 * Composes the snapshot. `actor` must be a real `campaignUser` doc (the CLI
 * resolves and fails closed); loaders run with `overrideAccess: false` so the
 * snapshot is exactly what that role may read.
 *
 * @param {object} params
 * @param {import('payload').Payload} params.payload
 * @param {import('../src/payload-types.ts').CampaignUser} params.actor
 * @param {string} params.slug
 * @param {string} [params.readAt]
 * @param {string | null} [params.codeSha]
 * @param {string | null} [params.database]
 */
export const composeCityReportSnapshot = async ({
  payload,
  actor,
  slug,
  readAt = new Date().toISOString(),
  codeSha = null,
  database = null,
}) => {
  const context = await resolveAccessibleMunicipalityContext(payload, actor, slug)
  const detail = await getMunicipalityDetailViewModel(payload, context, actor)
  const dossier = await loadMunicipalityDossierData(payload, actor, detail)
  const [advisors, speeches, demands] = await Promise.all([
    loadAdvisorSummaries(payload, actor, detail.advisorIDs),
    loadSpeeches(payload, actor, context.id),
    loadDemands(payload, actor, context.id),
  ])

  const strategy = detail.strategy
  const rank2022 = getMunicipalityVoteRank(slug)

  return {
    meta: {
      source: 'Base Teqo (produção, leitura read-only)',
      readAt,
      readOnly: true,
      database,
      codeSha,
      actorId: actor.id,
      actorName: actor.name ?? null,
      actorRole: actor.role,
      actorRoleLabel: campaignRoleLabels[actor.role] ?? actor.role,
    },
    municipality: {
      id: context.id,
      slug: context.slug,
      name: detail.name,
      kind: detail.kind,
      region: detail.region,
      ibgeCode: detail.ibgeCode,
    },
    electoral: {
      series: dossier.baseline?.series ?? [],
      rank2022,
    },
    goal: dossier.goalAccount
      ? {
          suggestedGoal: dossier.goalAccount.suggestedGoal,
          goalCoverage: dossier.goalAccount.goalCoverage,
          territorialClass: { class: dossier.goalAccount.territorialClass.class },
        }
      : null,
    pledges: {
      declaredTotal: dossier.pledgeAggregate.declaredTotal,
      lastPledgeAt: dossier.pledgeAggregate.lastPledgeAt,
    },
    leaderships: {
      totalCount: dossier.leaderships.totalCount,
      rows: dossier.leaderships.rows.map((row) => ({
        id: row.id,
        name: row.name,
        supportStatus: row.supportStatus,
        organizationNames: row.organizationNames,
        hasAppAccess: row.hasAppAccess,
        updatedAt: row.updatedAt,
      })),
    },
    advisors: advisors.map((advisor) => ({ id: advisor.id, name: advisor.name })),
    signals: {
      totalCount: dossier.signals.totalCount,
      rows: dossier.signals.rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        body: row.body,
        polarity: row.polarity,
        urgent: row.urgent,
        adversarySignal: row.adversarySignal,
        responsibleName: row.responsibleName,
      })),
    },
    activities: {
      upcoming: dossier.upcomingActivities.map(projectActivity),
      recent: dossier.recentActivities.map(projectActivity),
    },
    conjuncture: strategy
      ? {
          priority: strategy.priority,
          expectedVotes: strategy.expectedVotes,
          politicalTrend: strategy.politicalTrend,
          engagementLevel: strategy.engagementLevel,
          levelNote: strategy.levelNote,
          strengths: strategy.strengths,
          risks: strategy.risks,
          dobradinhaNotes: strategy.dobradinhaNotes,
          nextSteps: strategy.nextSteps,
          budgetNotes: strategy.budgetNotes,
          stateDeputies: strategy.stateDeputies.map((deputy) => ({
            id: deputy.id,
            name: deputy.name,
            party: deputy.party,
          })),
        }
      : null,
    speeches,
    demands,
    demographics: dossier.demographics,
  }
}
