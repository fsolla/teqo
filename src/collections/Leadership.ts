import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import {
  canCreateLeadership,
  canDeleteLeadership,
  canManageCampaignStaffField,
  canManageLeadership,
  canReadCampaignStaffField,
  canReadLeadership,
  canSetAdministrativeLeadershipField,
} from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'

const MAX_LEADERSHIP_PLAZAS = 30

const requireAtLeastOnePlaza: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data) return data

  const plazas =
    data.plazas !== undefined
      ? data.plazas
      : operation === 'update'
        ? originalDoc?.plazas
        : undefined
  const plazaIDs = (Array.isArray(plazas) ? plazas : [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)

  if (plazaIDs.length === 0) {
    throw new APIError('Vincule a liderança a pelo menos uma Praça.', 400)
  }
  if (new Set(plazaIDs).size !== plazaIDs.length) {
    throw new APIError('Cada Praça deve aparecer apenas uma vez.', 400)
  }

  return data
}

export const Leadership: CollectionConfig = {
  slug: 'leadership',
  labels: {
    singular: 'Liderança',
    plural: 'Lideranças',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'contact',
    defaultColumns: ['contact', 'plazas', 'sector', 'supportStatus', 'updatedAt'],
  },
  access: {
    create: canCreateLeadership,
    read: canReadLeadership,
    update: canManageLeadership,
    delete: canDeleteLeadership,
  },
  hooks: {
    beforeValidate: [requireAtLeastOnePlaza],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user?.collection === 'campaignUser') {
          data.createdBy = req.user.id
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
      unique: true,
      index: true,
      access: {
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'plazas',
      type: 'relationship',
      relationTo: 'plaza',
      label: 'Praças',
      required: true,
      hasMany: true,
      index: true,
      maxRows: MAX_LEADERSHIP_PLAZAS,
    },
    {
      name: 'organizations',
      type: 'relationship',
      relationTo: 'organization',
      label: 'Organizações',
      hasMany: true,
      index: true,
    },
    {
      name: 'sector',
      type: 'select',
      label: 'Setor',
      index: true,
      options: [
        { label: 'Religioso', value: 'religioso' },
        { label: 'Sindical', value: 'sindical' },
        { label: 'Comunitário', value: 'comunitario' },
        { label: 'Rural', value: 'rural' },
        { label: 'Empresarial', value: 'empresarial' },
        { label: 'Juventude', value: 'juventude' },
        { label: 'Saúde', value: 'saude' },
        { label: 'Educação', value: 'educacao' },
        { label: 'Cultura', value: 'cultura' },
        { label: 'Outro', value: 'outro' },
      ],
    },
    {
      name: 'sectorNotes',
      type: 'textarea',
      label: 'Observações do setor',
      maxLength: 1000,
    },
    {
      name: 'supportStatus',
      type: 'select',
      label: 'Status de apoio',
      required: true,
      defaultValue: 'a_abordar',
      index: true,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      options: [
        { label: 'Engajado', value: 'engajado' },
        { label: 'A abordar', value: 'a_abordar' },
        { label: 'Em disputa', value: 'em_disputa' },
        { label: 'Negativo', value: 'negativo' },
      ],
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Acesso ao app',
      index: true,
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'consent',
      type: 'relationship',
      relationTo: 'consent',
      label: 'Consentimento confirmado',
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
      },
    },
    {
      name: 'consentContentHash',
      type: 'text',
      label: 'Hash do conteúdo consentido',
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
      label: 'Consentimento confirmado em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetAdministrativeLeadershipField,
        update: canSetAdministrativeLeadershipField,
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
