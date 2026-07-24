import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { signatureContactToCSV, signaturePetitionToCSV } from '@/utilities/signatureExport'
import { CollectionConfig } from 'payload'

export const Signature: CollectionConfig = {
  slug: 'signature',
  labels: {
    singular: 'Assinatura',
    plural: 'Assinaturas',
  },
  admin: {
    group: 'Abaixo-assinados',
  },
  // Citizen PII. Public petition flows write via the Local API without a user
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
      custom: {
        'plugin-import-export': {
          toCSV: signatureContactToCSV,
        },
      },
    },
    {
      type: 'relationship',
      name: 'petition',
      label: 'Abaixo-assinado',
      required: true,
      relationTo: 'petition',
      custom: {
        'plugin-import-export': {
          toCSV: signaturePetitionToCSV,
        },
      },
    },
    {
      type: 'relationship',
      name: 'consent',
      label: 'Consentimento',
      required: true,
      relationTo: 'consent',
      custom: {
        'plugin-import-export': {
          disabled: true,
        },
      },
    },
    {
      name: 'comment',
      type: 'textarea',
      label: 'Comentario',
      maxLength: 1000,
    },
  ],
}
