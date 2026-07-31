import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateGlobal } from '@/utilities/globals'
import type { GlobalConfig } from 'payload'

const slug = 'privacy-policy'

const revalidate = async ({ context }: { context?: { skipRevalidation?: boolean } }) => {
  if (context?.skipRevalidation) return
  await revalidateGlobal(slug)
}

export const PrivacyPolicy: GlobalConfig = {
  slug,
  label: 'Política de Privacidade',
  admin: {
    group: 'Configurações',
    description:
      'Aviso de Privacidade institucional exibido em /privacidade. Publicar somente após revisão jurídica.',
  },
  access: {
    read: () => true,
    // Legal text: admin-only like the other site globals (Pass 4) — campaign
    // JWTs reach /api/*.
    update: payloadAdminOnly,
  },
  hooks: {
    afterChange: [revalidate],
  },
  fields: [
    {
      name: 'published',
      type: 'checkbox',
      label: 'Publicado',
      defaultValue: false,
      admin: {
        description: 'Quando desmarcado, a rota pública /privacidade retorna 404.',
      },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Texto',
      required: true,
    },
  ],
}
