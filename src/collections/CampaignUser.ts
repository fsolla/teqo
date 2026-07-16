import type { CollectionConfig } from 'payload'

export const CampaignUser: CollectionConfig = {
  slug: 'campaignUser',
  labels: {
    singular: 'Usuário',
    plural: 'Usuários',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      required: true,
    },
  ],
}
