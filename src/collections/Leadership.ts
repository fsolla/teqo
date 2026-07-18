import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import {
  canCreateLeadership,
  canDeleteLeadership,
  canManageLeadership,
  canManageLeadershipInternal,
  canReadLeadership,
  canReadLeadershipInternal,
  canSetAdministrativeLeadershipField,
} from '@/utilities/campaignAccess'
import { acquirePrimaryContactInvariantLocks } from '@/utilities/primaryContactInvariantLock'
import { relationshipId } from '@/utilities/relationship'

export const Leadership: CollectionConfig = {
  slug: 'leadership',
  labels: {
    singular: 'Liderança',
    plural: 'Lideranças',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'contact',
    defaultColumns: ['contact', 'nucleus', 'sector', 'supportStatus', 'updatedAt'],
  },
  access: {
    create: canCreateLeadership,
    read: canReadLeadership,
    update: canManageLeadership,
    delete: canDeleteLeadership,
  },
  indexes: [
    {
      fields: ['contact', 'nucleus'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (operation === 'create' && req.user?.collection === 'campaignUser') {
          data.createdBy = req.user.id
        }

        if (operation !== 'update') return data
        const previousContact = relationshipId(originalDoc?.contact)
        const previousNucleus = relationshipId(originalDoc?.nucleus)
        const nextContact = relationshipId(data.contact ?? originalDoc?.contact)
        const nextNucleus = relationshipId(data.nucleus ?? originalDoc?.nucleus)
        const nextStatus = data.supportStatus ?? originalDoc?.supportStatus
        if (!previousContact || !previousNucleus || !nextContact || !nextNucleus) return data

        await acquirePrimaryContactInvariantLocks(req, [previousNucleus, nextNucleus])
        const remainsEligible =
          nextStatus === 'engajado' &&
          nextContact === previousContact &&
          nextNucleus === previousNucleus
        if (remainsEligible) return data

        const primaryContactUse = await req.payload.find({
          collection: 'electoralNucleus',
          where: {
            and: [
              { id: { equals: previousNucleus } },
              { primaryContact: { equals: previousContact } },
            ],
          },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })

        if (primaryContactUse.totalDocs > 0) {
          throw new APIError(
            'Escolha outro contato principal antes de alterar o status desta liderança.',
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
      name: 'nucleus',
      type: 'relationship',
      relationTo: 'electoralNucleus',
      label: 'Núcleo eleitoral',
      required: true,
      index: true,
      access: {
        update: canSetAdministrativeLeadershipField,
      },
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
        create: canManageLeadershipInternal,
        read: canReadLeadershipInternal,
        update: canManageLeadershipInternal,
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
        create: canManageLeadershipInternal,
        read: canReadLeadershipInternal,
        update: canManageLeadershipInternal,
      },
    },
    {
      name: 'consentNote',
      type: 'textarea',
      label: 'Registro de consentimento externo',
      maxLength: 2000,
      access: {
        create: canManageLeadershipInternal,
        read: canReadLeadershipInternal,
        update: canManageLeadershipInternal,
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
        read: canReadLeadershipInternal,
        update: canSetAdministrativeLeadershipField,
      },
    },
  ],
}
