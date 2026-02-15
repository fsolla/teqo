import { revalidateGlobal } from '@/utilities/globals'
import { GlobalConfig } from 'payload'

const slug = 'metadata'

const revalidate = async () => revalidateGlobal(slug)

export const Metadata: GlobalConfig = {
  slug,
  label: 'Metadados',
  admin: {
    group: 'Configurações',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [revalidate],
  },
  fields: [
    {
      name: 'URL',
      label: 'URL',
      type: 'text',
      required: true,
    },
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      label: 'Descrição',
      type: 'textarea',
      required: true,
    },
    {
      name: 'keywords',
      label: 'Palavras-chave',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'keyword',
          label: 'Palavra-chave',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'openGraph',
      label: 'Open Graph',
      type: 'group',
      fields: [
        {
          name: 'siteName',
          label: 'Nome do Site',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          label: 'Descrição',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      name: 'twitter',
      label: 'Twitter',
      type: 'group',
      fields: [
        {
          name: 'creator',
          label: 'Criador',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          label: 'Descrição',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      name: 'image',
      label: 'Imagem',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
