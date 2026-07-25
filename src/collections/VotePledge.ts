import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import {
  canCreateVotePledge,
  canDeleteVotePledge,
  canManageCampaignStaffField,
  canReadCampaignStaffField,
  canReadVotePledge,
  canSetCampaignSystemField,
  canUpdateVotePledge,
  payloadAdminOnly,
} from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'
import {
  type VoteEstimateScenarioFields,
  getVoteEstimateOrderViolation,
  VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
} from '@/lib/voteEstimate'
import {
  voteEstimateScenarioGroupAccess,
  voteEstimateScenarioGroupFields,
} from '@/utilities/voteEstimateScenarioFields'

/**
 * Vote pledge per leadership × municipality. The leader DECLARES how many votes they
 * are bringing (`declaredVotes` — the only number they ever see); staff record
 * their own ESTIMATE of the real value (`estimatedVotes` pessimistic/central/
 * optimistic), which is never serialized to the leader (field access denies
 * read). Municipality aggregates use `estimated[S] ?? declared` on staff surfaces only.
 */

const normalizeEstimateGroup = (
  value: VoteEstimateScenarioFields | number | null | undefined,
): VoteEstimateScenarioFields | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'number') {
    return { central: value, pessimistic: null, optimistic: null }
  }
  return value
}

const estimateGroupChanged = (
  next: VoteEstimateScenarioFields | null | undefined,
  previous: VoteEstimateScenarioFields | null | undefined,
): boolean => {
  if (next === undefined) return false
  const normalizedNext = normalizeEstimateGroup(next) ?? {}
  const normalizedPrevious = normalizeEstimateGroup(previous) ?? {}
  return (
    normalizedNext.pessimistic !== normalizedPrevious.pessimistic ||
    normalizedNext.central !== normalizedPrevious.central ||
    normalizedNext.optimistic !== normalizedPrevious.optimistic
  )
}

const validatePledgeIntegrity: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const leadershipID = relationshipId(data.leadership ?? originalDoc?.leadership)
  const municipalityID = relationshipId(data.municipality ?? originalDoc?.municipality)
  if (!leadershipID || !municipalityID) {
    throw new APIError('Informe a liderança e o município do compromisso de votos.', 400)
  }

  if (operation === 'update') {
    const previousLeadership = relationshipId(originalDoc?.leadership)
    const previousMunicipality = relationshipId(originalDoc?.municipality)
    if (
      (data.leadership !== undefined && leadershipID !== previousLeadership) ||
      (data.municipality !== undefined && municipalityID !== previousMunicipality)
    ) {
      throw new APIError('A liderança e o município do compromisso não podem ser alterados.', 409)
    }
  }

  const leadership = await req.payload.findByID({
    collection: 'leadership',
    id: leadershipID,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const linkedMunicipalityIDs = (Array.isArray(leadership.municipalities) ? leadership.municipalities : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)

  if (!linkedMunicipalityIDs.includes(municipalityID)) {
    throw new APIError('A liderança precisa estar vinculada ao município para declarar votos nele.', 409)
  }

  return data
}

const deriveVotePledgeAudit: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const actorID = req.user?.collection === 'campaignUser' ? req.user.id : null

  if (data.declaredVotes !== undefined && data.declaredVotes !== originalDoc?.declaredVotes) {
    data.declaredAt = new Date().toISOString()
    if (actorID) data.declaredBy = actorID
  }

  const estimateChanged =
    estimateGroupChanged(
      data.estimatedVotes as VoteEstimateScenarioFields | undefined,
      originalDoc?.estimatedVotes as VoteEstimateScenarioFields | null | undefined,
    ) ||
    (data.estimateNote !== undefined && data.estimateNote !== originalDoc?.estimateNote)

  if (estimateChanged) {
    data.estimatedAt = new Date().toISOString()
    if (actorID) data.estimatedBy = actorID
  }

  return data
}

const validateEstimateOrder: CollectionBeforeChangeHook = ({ data }) => {
  const violation = getVoteEstimateOrderViolation(
    data.estimatedVotes as VoteEstimateScenarioFields | null | undefined,
  )
  if (violation) {
    throw new APIError(VOTE_ESTIMATE_ORDER_ERROR_MESSAGE, 400)
  }
  return data
}

export const VotePledge: CollectionConfig = {
  slug: 'votePledge',
  labels: {
    singular: 'Votos declarados',
    plural: 'Votos declarados',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'id',
    defaultColumns: ['leadership', 'municipality', 'declaredVotes', 'estimatedVotes.central', 'updatedAt'],
  },
  access: {
    create: canCreateVotePledge,
    read: canReadVotePledge,
    readVersions: payloadAdminOnly,
    update: canUpdateVotePledge,
    delete: canDeleteVotePledge,
  },
  versions: {
    maxPerDoc: 0,
  },
  indexes: [
    {
      fields: ['leadership', 'municipality'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [validatePledgeIntegrity, validateEstimateOrder, deriveVotePledgeAudit],
  },
  fields: [
    {
      name: 'leadership',
      type: 'relationship',
      relationTo: 'leadership',
      label: 'Liderança',
      required: true,
      index: true,
    },
    {
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Município',
      required: true,
      index: true,
    },
    {
      name: 'declaredVotes',
      type: 'number',
      label: 'Votos declarados pela liderança',
      required: true,
      min: 0,
      index: true,
    },
    {
      name: 'declaredAt',
      type: 'date',
      label: 'Declarado em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'declaredBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Declarado por',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'estimatedVotes',
      type: 'group',
      label: 'Votos estimados pelo assessor',
      admin: {
        description:
          'Faixa interna pessimista / média / otimista. A liderança nunca vê estes números.',
      },
      access: voteEstimateScenarioGroupAccess,
      fields: voteEstimateScenarioGroupFields(),
    },
    {
      name: 'estimateNote',
      type: 'textarea',
      label: 'Justificativa da estimativa',
      maxLength: 1000,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
    },
    {
      name: 'estimatedBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Estimado por',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        read: canReadCampaignStaffField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'estimatedAt',
      type: 'date',
      label: 'Estimado em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        read: canReadCampaignStaffField,
        update: canSetCampaignSystemField,
      },
    },
  ],
}
