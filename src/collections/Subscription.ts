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
    defaultColumns: ['contact', 'consent', 'campaignLevel', 'comment'],
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
    {
      // S9 — the campaign home capture records the visitor's engagement
      // choice ("Quero fazer parte do time" vs "esporádico") as data, so the
      // admin can tell who may join WhatsApp groups. Nullable on purpose: the
      // WhatsApp community flow writes subscriptions without it; only the
      // campaign newsletter schema sets it (zod-required).
      name: 'campaignLevel',
      type: 'select',
      label: 'Nível de engajamento',
      required: false,
      options: [
        { label: 'Fazer parte do time', value: 'time' },
        { label: 'Comunicações esporádicas', value: 'esporadico' },
      ],
    },
  ],
}
