import { canManagePublishedContent } from '@/utilities/campaignAccess'
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Mídia',
    plural: 'Mídias',
  },
  admin: {
    group: 'Coleções',
  },
  // Campaign flows (avatar, demand receipts) upload via server actions with an
  // explicit overrideAccess: true after their own role checks.
  access: {
    read: () => true,
    create: canManagePublishedContent,
    update: canManagePublishedContent,
    delete: canManagePublishedContent,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      admin: {
        description: 'Descrição da imagem para acessibilidade.',
      },
      required: true,
    },
  ],
  upload: true,
}
