import { revalidateGlobal } from '@/utilities/globals'
import { revalidateTag } from 'next/cache'
import type { GlobalConfig } from 'payload'

const slug = 'site-settings'

const revalidate = async () => revalidateGlobal(slug)

export const SiteSettings: GlobalConfig = {
  slug,
  label: 'Configurações do site',
  admin: {
    group: 'Configurações',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'headerTitle',
      type: 'text',
      label: 'Título do cabeçalho',
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Redes sociais',
      labels: {
        singular: 'Rede social',
        plural: 'Redes sociais',
      },
      fields: [
        {
          name: 'platform',
          type: 'select',
          label: 'Plataforma',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'YouTube', value: 'youtube' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
          required: true,
          validate: (value: string | null | undefined) => {
            if (!value) return 'A URL é obrigatória'
            try {
              const parsed = new URL(value)
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                return 'A URL deve começar com http:// ou https://'
              }
              return true
            } catch {
              return 'Informe uma URL válida'
            }
          },
        },
        {
          name: 'label',
          type: 'text',
          label: 'Rótulo de acessibilidade',
          admin: {
            description:
              'Rótulo opcional para acessibilidade. Se estiver vazio, usamos um rótulo padrão da plataforma.',
          },
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Ativo',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidate],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 1000,
      },
      schedulePublish: true,
    },
    max: 10,
  },
}
