import {
  SHARE_LINK_DESCRIPTION_MAX_LENGTH,
  SHARE_LINK_DESTINATION_INVALID_MESSAGE,
  SHARE_LINK_SLUG_DUPLICATE_MESSAGE,
  SHARE_LINK_SLUG_INVALID_MESSAGE,
  SHARE_LINK_SLUG_RESERVED_MESSAGE,
  SHARE_LINK_TITLE_MAX_LENGTH,
  isReservedShareLinkSlug,
  isValidShareLinkDestination,
  isValidShareLinkSlug,
} from '@/lib/shareLink'
import { slugify } from '@/lib/slug'
import { canManagePublishedContent, hasPayloadPanelAccess } from '@/utilities/campaignAccess'
import { revalidateShareLinksListing } from '@/utilities/documents'
import type { Access, CollectionConfig, TextFieldSingleValidation } from 'payload'

/**
 * S19 — share links: `jorgesolla1313.com.br/<slug>` serves our own HTML with
 * the configured Open Graph card while the visitor goes straight to the
 * external destination. `published` is the kill switch (unchecked → 404);
 * anonymous reads fail closed through the `where` constraint.
 */
const readShareLink: Access = ({ req }) =>
  hasPayloadPanelAccess(req.user) ? true : { published: { equals: true } }

const validateSlug: TextFieldSingleValidation = async (value, { req, id }) => {
  if (typeof value !== 'string' || !value) return SHARE_LINK_SLUG_INVALID_MESSAGE
  if (!isValidShareLinkSlug(value)) return SHARE_LINK_SLUG_INVALID_MESSAGE
  if (isReservedShareLinkSlug(value)) return SHARE_LINK_SLUG_RESERVED_MESSAGE

  const existing = await req.payload.find({
    collection: 'shareLink',
    where: {
      slug: { equals: value },
      ...(id !== undefined && id !== null ? { id: { not_equals: id } } : {}),
    },
    limit: 1,
    depth: 0,
    // Deliberate access bypass — uniqueness must see every row (drafts
    // included for a plain user); admin writes are gated upstream.
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) return SHARE_LINK_SLUG_DUPLICATE_MESSAGE

  return true
}

const validateDestination: TextFieldSingleValidation = (value) => {
  if (typeof value !== 'string' || !value) return SHARE_LINK_DESTINATION_INVALID_MESSAGE
  if (!isValidShareLinkDestination(value)) return SHARE_LINK_DESTINATION_INVALID_MESSAGE
  return true
}

export const ShareLink: CollectionConfig = {
  slug: 'shareLink',
  labels: {
    singular: 'Link de compartilhamento',
    plural: 'Links de compartilhamento',
  },
  admin: {
    group: 'Publicações',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'destination', 'published'],
    description:
      'Links curtos com miniatura personalizada para compartilhar no WhatsApp. O endereço é jorgesolla1313.com.br/<slug> e o clique leva direto ao destino.',
  },
  access: {
    read: readShareLink,
    create: canManagePublishedContent,
    update: canManagePublishedContent,
    delete: canManagePublishedContent,
  },
  hooks: {
    afterChange: [revalidateShareLinksListing],
    afterDelete: [revalidateShareLinksListing],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      maxLength: SHARE_LINK_TITLE_MAX_LENGTH,
      admin: {
        description:
          'Título do cartão no WhatsApp — o WhatsApp mostra no máximo 2 linhas (~60–90 caracteres).',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Endereço curto: jorgesolla1313.com.br/<slug>. Gerado do título quando vazio; não pode repetir nem usar palavra reservada do site. O WhatsApp guarda a miniatura em cache por URL: para trocar a miniatura de um link já compartilhado, use um slug novo.',
      },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) => {
            if (value) return slugify(String(value))
            if (siblingData?.title) return slugify(String(siblingData.title))
            return value
          },
        ],
      },
      validate: validateSlug,
    },
    {
      name: 'destination',
      type: 'text',
      label: 'Destino',
      required: true,
      admin: {
        description:
          'URL completa do destino (ex.: o link do Google Meet da plenária), começando com http:// ou https://.',
      },
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
      },
      validate: validateDestination,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      required: true,
      maxLength: SHARE_LINK_DESCRIPTION_MAX_LENGTH,
      admin: {
        description:
          'Texto do cartão no WhatsApp: ~80 caracteres já bastam; evitar passar de ~160.',
      },
    },
    {
      name: 'image',
      type: 'upload',
      label: 'Imagem',
      relationTo: 'media',
      admin: {
        description:
          'Imagem do cartão: 1200×630 px (proporção 1,91:1), arquivo até 600 KB, JPG ou PNG, largura mínima 300 px; evitar imagens muito largas (proporção máx. 4:1). A página do link monta a URL pública absoluta na hora de exibir o cartão. Vazio = imagem padrão do site.',
      },
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Publicado',
      defaultValue: false,
      admin: {
        description: 'Desmarcado, o link responde 404 (kill switch).',
      },
    },
  ],
}
