import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { CollectionConfig } from 'payload'

export const Subscription: CollectionConfig = {
  slug: 'subscription',
  labels: {
    singular: 'Assinatura',
    plural: 'Assinaturas',
  },
  admin: {
    group: 'Contatos',
  },
  // Citizen PII. Public opt-in flows write via the Local API without a user
  // (overrideAccess defaults to true), so admin-only access does not affect them.
  access: {
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      type: 'relationship',
      name: 'contact',
      label: 'Contato',
      required: true,
      relationTo: 'contact',
    },
    {
      type: 'relationship',
      name: 'consent',
      label: 'Consentimento',
      required: true,
      relationTo: 'consent',
    },
    {
      name: 'comment',
      type: 'textarea',
      label: 'Comentario',
      maxLength: 1000,
    },
  ],
}
