import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { CollectionConfig } from 'payload'

export const Consent: CollectionConfig = {
  slug: 'consent',
  labels: {
    singular: 'Consentimento',
    plural: 'Consentimentos',
  },
  admin: {
    group: 'Contatos',
    useAsTitle: 'text',
  },
  // Versioned legal texts referenced by signatures/subscriptions/supporters.
  // Server flows resolve them via the Local API without a user; only admins
  // may create or alter them.
  access: {
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      label: 'Chave estável',
      required: false,
      unique: true,
      index: true,
      admin: {
        description: 'Identificador estável para referências no código.',
      },
    },
    {
      name: 'text',
      type: 'richText',
      label: 'Texto',
      required: true,
    },
  ],
}
