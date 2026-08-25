import { canManagePublishedContent } from '@/utilities/campaignAccess'
import { revalidateDocumentById } from '@/utilities/documents'
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
  // The public pages read media through `getCachedDocumentById('media', …)`
  // (`unstable_cache` under the `document_media:<id>` tag), so admin edits and
  // deletions must bust that cache — same contract as Post/Petition.
  hooks: {
    afterChange: [
      ({ doc, previousDoc }) => {
        revalidateDocumentById('media', previousDoc?.id ?? doc.id)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        revalidateDocumentById('media', doc.id)
      },
    ],
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
