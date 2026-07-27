import { slugify } from '@/lib/slug'
import { canManagePublishedContent } from '@/utilities/campaignAccess'
import { revalidateDocumentById, revalidatePostsListing } from '@/utilities/documents'
import type { CollectionConfig } from 'payload'

const slug = 'post'

export const Post: CollectionConfig<typeof slug> = {
  slug,
  labels: {
    singular: 'Publicação',
    plural: 'Publicações',
  },
  admin: {
    group: 'Publicações',
    useAsTitle: 'title',
  },
  versions: {
    drafts: {
      schedulePublish: true,
    },
    maxPerDoc: 5,
  },
  access: {
    read: () => true,
    readVersions: canManagePublishedContent,
    create: canManagePublishedContent,
    update: canManagePublishedContent,
    delete: canManagePublishedContent,
  },
  hooks: {
    afterChange: [
      ({ doc, previousDoc, operation }) => {
        // Admin create view creates the initial draft during render.
        // Skip cache invalidation only for that first draft creation.
        if (operation === 'create' && doc._status !== 'published') return

        revalidateDocumentById(slug, previousDoc?.id ?? doc.id)
        revalidatePostsListing()
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      unique: true,
      index: true,
      admin: {
        description: 'Gerado automaticamente a partir do título quando vazio.',
      },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) => {
            if (value) return slugify(value as string)
            if (siblingData?.title) return slugify(siblingData.title as string)
            return value
          },
        ],
      },
    },
    {
      name: 'type',
      type: 'select',
      label: 'Tipo',
      required: true,
      options: [
        { label: 'Notícia', value: 'noticia' },
        { label: 'Campanha', value: 'campanha' },
        { label: 'Artigo', value: 'artigo' },
        { label: 'Evento', value: 'evento' },
      ],
    },
    {
      name: 'category',
      type: 'relationship',
      label: 'Categoria',
      relationTo: 'tag',
      required: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      label: 'Tags',
      relationTo: 'tag',
      hasMany: true,
    },
    {
      name: 'subtitle',
      type: 'text',
      label: 'Subtítulo',
    },
    {
      name: 'coverImage',
      type: 'upload',
      label: 'Imagem de capa',
      relationTo: 'media',
    },
    {
      name: 'publishedDate',
      type: 'date',
      label: 'Data de publicação',
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Corpo',
    },
  ],
}
