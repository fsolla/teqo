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
  fields: [
    {
      name: 'text',
      type: 'richText',
      label: 'Texto',
      required: true,
    },
  ],
}
