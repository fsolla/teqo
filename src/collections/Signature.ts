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
      name: 'petition',
      label: 'Abaixo-assinado',
      required: true,
      relationTo: 'petition',
    },
    {
      type: 'relationship',
      name: 'consent',
      label: 'Consentimento',
      required: true,
      relationTo: 'consent',
    },
  ],
}
