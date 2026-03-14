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
