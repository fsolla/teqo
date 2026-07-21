import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import {
  canCreateSupporter,
  canDeleteSupporter,
  canManageCampaignStaffField,
  canManageSupporter,
  canReadCampaignStaffField,
  canReadSupporter,
  canSetAdministrativeLeadershipField,
} from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'

export const Supporter: CollectionConfig = {
  slug: 'supporter',
  labels: {
    singular: 'Apoiador',
    plural: 'Apoiadores',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'contact',
    defaultColumns: ['contact', 'plaza', 'voteIntention', 'source', 'updatedAt'],
  },
  access: {
    create: canCreateSupporter,
    read: canReadSupporter,
    update: canManageSupporter,
    delete: canDeleteSupporter,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (operation === 'create' && req.user?.collection === 'campaignUser') {
          data.createdBy = req.user.id
        }

        const contactID = relationshipId(data.contact ?? originalDoc?.contact)
        const plazaID = relationshipId(data.plaza ?? originalDoc?.plaza)
        if (!contactID || !plazaID) return data

        const existingLeadership = await req.payload.find({
          collection: 'leadership',
          where: {
            and: [{ contact: { equals: contactID } }, { plazas: { in: [plazaID] } }],
          },
          depth: 0,
          limit: 1,
          pagination: false,
          overrideAccess: true,
          req,
        })

        if (existingLeadership.totalDocs > 0) {
          throw new APIError(
            'Este contato já é liderança nesta Praça e não pode ser cadastrado como apoiador.',
            409,
          )
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'contact',
      type: 'relationship',
      relationTo: 'contact',
      label: 'Contato',
      required: true,
      index: true,
      access: {
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'plaza',
      type: 'relationship',
      relationTo: 'plaza',
      label: 'Praça',
      index: true,
      access: {
        update: canManageCampaignStaffField,
      },
    },
    {
      name: 'voteIntention',
      type: 'select',
      label: 'Intenção de voto',
      index: true,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      options: [
        { label: 'Certo', value: 'certo' },
        { label: 'Tende a certo', value: 'tende_a_certo' },
        { label: 'Indeciso', value: 'indeciso' },
        { label: 'Outro', value: 'outro' },
      ],
    },
    {
      name: 'consent',
      type: 'relationship',
      relationTo: 'consent',
      label: 'Consentimento de cadastro',
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'consentContentHash',
      type: 'text',
      label: 'Hash do consentimento de cadastro',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'consentedAt',
      type: 'date',
      label: 'Consentimento de cadastro em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'voteIntentionConsent',
      type: 'relationship',
      relationTo: 'consent',
      label: 'Consentimento de intenção de voto',
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'voteIntentionConsentContentHash',
      type: 'text',
      label: 'Hash do consentimento de intenção',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'voteIntentionConsentedAt',
      type: 'date',
      label: 'Consentimento de intenção em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Origem',
      required: true,
      defaultValue: 'manual',
      index: true,
      options: [
        { label: 'Importação CSV', value: 'import_csv' },
        { label: 'Cadastro manual', value: 'manual' },
        { label: 'Convite', value: 'convite' },
        { label: 'Evento', value: 'evento' },
      ],
      access: {
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'consentNote',
      type: 'textarea',
      label: 'Registro de consentimento externo',
      maxLength: 2000,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Observações internas',
      maxLength: 3000,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Criado por',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetAdministrativeLeadershipField,
        read: canReadCampaignStaffField,
        update: canSetAdministrativeLeadershipField,
      },
    },
  ],
}
