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
} from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'

/**
 * Vote pledge per leadership × plaza. The leader DECLARES how many votes they
 * are bringing (`declaredVotes` — the only number they ever see); staff record
 * their own ESTIMATE of the real value (`estimatedVotes`), which is never
 * serialized to the leader (field access denies read). Plaza aggregates use
 * `estimatedVotes ?? declaredVotes` on staff surfaces only.
 */

const validatePledgeIntegrity: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const leadershipID = relationshipId(data.leadership ?? originalDoc?.leadership)
  const plazaID = relationshipId(data.plaza ?? originalDoc?.plaza)
  if (!leadershipID || !plazaID) {
    throw new APIError('Informe a liderança e a Praça do compromisso de votos.', 400)
  }

  if (operation === 'update') {
    const previousLeadership = relationshipId(originalDoc?.leadership)
    const previousPlaza = relationshipId(originalDoc?.plaza)
    if (
      (data.leadership !== undefined && leadershipID !== previousLeadership) ||
      (data.plaza !== undefined && plazaID !== previousPlaza)
    ) {
      throw new APIError('A liderança e a Praça do compromisso não podem ser alteradas.', 409)
    }
  }

  const leadership = await req.payload.findByID({
    collection: 'leadership',
    id: leadershipID,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const linkedPlazaIDs = (Array.isArray(leadership.plazas) ? leadership.plazas : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)

  if (!linkedPlazaIDs.includes(plazaID)) {
    throw new APIError('A liderança precisa estar vinculada à Praça para declarar votos nela.', 409)
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
    (data.estimatedVotes !== undefined && data.estimatedVotes !== originalDoc?.estimatedVotes) ||
    (data.estimateNote !== undefined && data.estimateNote !== originalDoc?.estimateNote)

  if (estimateChanged) {
    data.estimatedAt = new Date().toISOString()
    if (actorID) data.estimatedBy = actorID
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
    defaultColumns: ['leadership', 'plaza', 'declaredVotes', 'estimatedVotes', 'updatedAt'],
  },
  access: {
    create: canCreateVotePledge,
    read: canReadVotePledge,
    update: canUpdateVotePledge,
    delete: canDeleteVotePledge,
  },
  indexes: [
    {
      fields: ['leadership', 'plaza'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [validatePledgeIntegrity, deriveVotePledgeAudit],
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
      name: 'plaza',
      type: 'relationship',
      relationTo: 'plaza',
      label: 'Praça',
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
      type: 'number',
      label: 'Votos estimados pelo assessor',
      min: 0,
      index: true,
      admin: {
        description: 'Estimativa interna do valor real. A liderança nunca vê este número.',
      },
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
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
