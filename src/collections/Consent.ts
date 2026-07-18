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
