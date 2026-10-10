/**
 * Snapshot composer for the city report (C163).
 *
 * Runs on the homeserver against production, read-only: composes the same
 * loaders the `/campanha` detail/dossier use (no parallel source of truth),
 * projects out PII and fields the report does not need, and returns plain
 * JSON. The render step never touches the database again.
 *
 * Since the 2026-10-10 refocus the report serves the 2º turno (Lula × Flávio):
 * the snapshot carries the network (leaderships, advisors, pledges), the base
 * strategy (conjuncture) and the IBGE demographics — the official 2º-turno
 * numbers come from the committed artifact, not from the database.
 *
 * Integration layer, not a pure lib: it imports Payload-coupled utilities and
 * is exercised by `tests/int/cityReportSnapshot.int.spec.ts`.
 */

import { campaignRoleLabels } from '../src/utilities/campaignUserProfile.ts'
import { loadMunicipalityDossierData } from '../src/utilities/municipality/municipalityDossierData.ts'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '../src/utilities/municipality/municipalityPageData.ts'
import { loadAdvisorSummaries } from '../src/utilities/municipality/municipalityViewModels.ts'

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
  const advisors = await loadAdvisorSummaries(payload, actor, detail.advisorIDs)

  const strategy = detail.strategy

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
    conjuncture: strategy
      ? {
          priority: strategy.priority,
          politicalTrend: strategy.politicalTrend,
          engagementLevel: strategy.engagementLevel,
          levelNote: strategy.levelNote,
          strengths: strategy.strengths,
          risks: strategy.risks,
          dobradinhaNotes: strategy.dobradinhaNotes,
          nextSteps: strategy.nextSteps,
          stateDeputies: strategy.stateDeputies.map((deputy) => ({
            id: deputy.id,
            name: deputy.name,
            party: deputy.party,
          })),
        }
      : null,
    demographics: dossier.demographics,
  }
}
