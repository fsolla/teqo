import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateDocumentById, revalidatePostsListing } from '@/utilities/documents'
import { slugify } from '@/utilities/slug'
import type { CollectionConfig } from 'payload'

const slug = 'tag'

export const Tag: CollectionConfig<typeof slug> = {
  slug,
  labels: {
    singular: 'Tag',
    plural: 'Tags',
  },
  admin: {
    group: 'Publicações',
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
    create: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        // Toggling a tag's visibility (e.g. the `eleitoral` tag) affects every
        // post that references it, so revalidate all of them plus the listing.
        const posts = await req.payload.find({
          collection: 'post',
          depth: 0,
          limit: 0,
          pagination: false,
          where: {
            or: [{ category: { equals: doc.id } }, { tags: { in: [doc.id] } }],
          },
          req,
        })

        for (const post of posts.docs) {
          revalidateDocumentById('post', post.id)
        }
        revalidatePostsListing()
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      unique: true,
      index: true,
      admin: {
        description: 'Gerado automaticamente a partir do nome quando vazio.',
      },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) => {
            if (value) return slugify(value as string)
            if (siblingData?.name) return slugify(siblingData.name as string)
            return value
          },
        ],
      },
    },
    {
      name: 'hidden',
      type: 'checkbox',
      label: 'Esconder',
      defaultValue: false,
      admin: {
        description: 'Esconde do site todas as publicações com esta tag.',
      },
    },
  ],
}
