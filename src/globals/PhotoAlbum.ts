import { isArchivePhotoRemovalChannelUrl } from '@/lib/archivePhotoCatalog'
import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateGlobal } from '@/utilities/globals'
import type { GlobalBeforeValidateHook, GlobalConfig } from 'payload'
import { ValidationError } from 'payload'

const slug = 'photoAlbum'

/**
 * C233 — the two product knobs of the public photo album, kept as data so a
 * pull-down never depends on a deploy:
 *
 * - `published` is the album's kill switch. `true` by explicit decision of the
 *   gate (2026-09-26): `/fotos` opens with the deploy instead of waiting for
 *   the election. Flipping it off in the admin closes the route immediately.
 * - `removalChannelUrl` is where a person asks for a photo of themselves to be
 *   taken down. It is never invented in code; a valid channel is a
 *   precondition for the album to be published and for a photo to be approved
 *   (see the collection's guard), so a public photo always has the channel
 *   that the album's notice points to.
 */
const validateRemovalChannel: GlobalBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const published = data.published ?? false
  if (published && !isArchivePhotoRemovalChannelUrl(data.removalChannelUrl)) {
    throw new ValidationError({
      errors: [
        {
          path: 'removalChannelUrl',
          message:
            'Configure um canal de remoção válido (https:// ou mailto:) antes de publicar o álbum.',
        },
      ],
    })
  }
  return data
}

const revalidate = async () => {
  revalidateGlobal(slug)
}

export const PhotoAlbum: GlobalConfig = {
  slug,
  label: 'Álbum de fotos',
  admin: {
    group: 'Configurações',
    description:
      'Chaves do álbum público (/fotos). Desmarcar "Publicado" tira a rota do ar imediatamente; o canal de remoção alimenta o aviso "é você nesta foto?".',
  },
  access: {
    read: () => true,
    // Public surface config: admin-only like the other site globals — campaign
    // JWTs reach /api/*.
    update: payloadAdminOnly,
  },
  hooks: {
    beforeValidate: [validateRemovalChannel],
    afterChange: [revalidate],
  },
  fields: [
    {
      name: 'published',
      type: 'checkbox',
      label: 'Publicado',
      defaultValue: true,
      admin: {
        description: 'Quando desmarcado, /fotos responde 404 (e some do índice) imediatamente.',
      },
    },
    {
      name: 'removalChannelUrl',
      type: 'text',
      label: 'Canal de remoção',
      admin: {
        description:
          'Link (https://) ou e-mail (mailto:) para pedir a remoção de uma foto. Obrigatório para publicar o álbum ou aprovar uma foto.',
      },
    },
    {
      name: 'selfieSearchEnabled',
      type: 'checkbox',
      label: 'Busca por selfie',
      defaultValue: false,
      admin: {
        description:
          'Liga a busca por selfie (/fotos/encontre). Nasce desligada: só abra com o consentimento configurado e o aval jurídico/DPIA registrados (C234).',
      },
    },
  ],
}
