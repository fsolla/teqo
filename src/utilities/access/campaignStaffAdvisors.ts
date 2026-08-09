// ---------------------------------------------------------------------------
// Campaign staff advisors (staff-to-entity relation: dobradinha, liderança)
// ---------------------------------------------------------------------------

import 'server-only'

import type { CollectionBeforeValidateHook, FieldAccess } from 'payload'
import { APIError } from 'payload'

import { uniqueRelationshipIds } from '@/lib/relationship'
import {
  eligibleCampaignStaffWhere,
  getFreshCampaignUser,
  isCampaignUnrestricted,
  isPayloadAdmin,
} from '@/utilities/access/shared'

/**
 * Every entity that lists staff advisors (`StateDeputy.advisors`,
 * `Leadership.advisors`) validates the same rule: each entry must be an
 * eligible staff account (coordinator/advisor/candidate). This is the third
 * copy of the hook — extracted so the policy has one owner.
 */
export const validateEligibleCampaignStaffAdvisors: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  if (!data || data.advisors === undefined) return data

  const advisorIDs = Array.isArray(data.advisors) ? uniqueRelationshipIds(data.advisors) : []
  if (advisorIDs.length === 0) return data

  const eligibleAdvisors = await req.payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    where: {
      and: [{ id: { in: advisorIDs } }, eligibleCampaignStaffWhere],
    },
    select: { name: true },
    // Intentional admin bypass: eligibility is a pure role check that must run
    // for every caller (including /admin), independent of the actor's read
    // scope over `campaignUser`.
    overrideAccess: true,
    req,
  })

  if (eligibleAdvisors.docs.length !== advisorIDs.length) {
    throw new APIError(
      'Cada assessor deve ter papel de Coordenador Geral, Assessor ou Candidato.',
      400,
    )
  }

  return data
}

/**
 * Advisor assignment on an entity is unrestricted staff (coordinator +
 * candidate) — the same policy as `Municipality.advisors` (B156) and
 * `StateDeputy.advisors`. The write path runs through the server action with
 * `overrideAccess` after `reloadUnrestrictedActor`; this guards direct `/admin`
 * edits.
 */
export const canAssignCampaignStaffAdvisors: FieldAccess = async ({ req }) => {
  if (isPayloadAdmin(req.user)) return true

  return isCampaignUnrestricted(await getFreshCampaignUser(req))
}

export const canManageCampaignStaffAdvisors: FieldAccess = ({ req }) => isPayloadAdmin(req.user)
