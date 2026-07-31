import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateGlobal } from '@/utilities/globals'
import { GlobalConfig } from 'payload'

const slug = 'home'

const revalidate = async () => revalidateGlobal(slug)

export const HomePage: GlobalConfig = {
  slug,
  label: 'Pagina Inicial',
  admin: {
    group: 'Paginas',
  },
  access: {
    read: () => true,
    // Admin-only like the other site globals (Pass 4) — campaign JWTs reach /api/*.
    update: payloadAdminOnly,
  },
  hooks: {
    afterChange: [revalidate],
  },
  fields: [
    {
      name: 'image',
      type: 'upload',
      label: 'Imagem',
      relationTo: 'media',
      required: true,
    },
  ],
}
