import {
  SHARE_LINK_DESCRIPTION_MAX_LENGTH,
  SHARE_LINK_DESTINATION_INVALID_MESSAGE,
  SHARE_LINK_DIRECT_WITHOUT_LIVE_MESSAGE,
  SHARE_LINK_EVENT_END_BEFORE_START_MESSAGE,
  SHARE_LINK_LIVE_DUPLICATE_MESSAGE,
  SHARE_LINK_MODE_OPTIONS,
  SHARE_LINK_SLUG_DUPLICATE_MESSAGE,
  SHARE_LINK_SLUG_INVALID_MESSAGE,
  SHARE_LINK_SLUG_RESERVED_MESSAGE,
  SHARE_LINK_TITLE_MAX_LENGTH,
  isReservedShareLinkSlug,
  isValidShareLinkDestination,
  isValidShareLinkSlug,
  resolveShareLinkMode,
  type ShareLinkDestinationLike,
} from '@/lib/shareLink'
import { slugify } from '@/lib/slug'
import { canManagePublishedContent, publishedOrPanelAccess } from '@/utilities/campaignAccess'
import { revalidateShareLinksListing } from '@/utilities/documents'
import type { TextFieldSingleValidation } from 'payload'
import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'

/**
 * S19 — share links: `jorgesolla1313.com.br/<slug>` serves our own HTML with
 * the configured Open Graph card while the visitor goes straight to the
 * external destination. `published` is the kill switch (unchecked → 404);
 * anonymous reads fail closed through the `where` constraint.
 *
 * S29 — per-link mode and the pre-registered destination pool: `direct` keeps
 * the S19 behavior (a live destination is required); `announcement` serves the
 * announcement page until the team flags one destination as "no ar", when the
 * link goes back to redirecting. Existing links (mode null) behave as `direct`.
 */
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

/**
 * Cross-field rules of the link (same merge pattern as `Activity`): at most
 * one destination on air, a `direct` link always has one on air, and the
 * configured event window never ends before it starts.
 */
const validateShareLinkConfiguration: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  const destinations = Array.isArray(nextData.destinations)
    ? (nextData.destinations as ShareLinkDestinationLike[])
    : []

  const liveCount = destinations.filter((destination) => destination?.live).length
  if (liveCount > 1) {
    throw new APIError(SHARE_LINK_LIVE_DUPLICATE_MESSAGE, 400)
  }

  // Only the absence of a flagged row is the `direct` rule's business: a live
  // row with a malformed URL must surface the field's own URL message (the
  // runtime read still fails closed on it).
  if (resolveShareLinkMode(nextData.mode) === 'direct' && liveCount === 0) {
    throw new APIError(SHARE_LINK_DIRECT_WITHOUT_LIVE_MESSAGE, 400)
  }

  const { startsAt, endsAt } = nextData
  if (startsAt && endsAt) {
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      start.getTime() >= end.getTime()
    ) {
      throw new APIError(SHARE_LINK_EVENT_END_BEFORE_START_MESSAGE, 400)
    }
  }

  return data
}

const announcementOnly = (_: unknown, siblingData: { mode?: string | null } | undefined) =>
  resolveShareLinkMode(siblingData?.mode) === 'announcement'

export const ShareLink: CollectionConfig = {
  slug: 'shareLink',
  labels: {
    singular: 'Link de compartilhamento',
    plural: 'Links de compartilhamento',
  },
  admin: {
    group: 'Publicações',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'mode', 'published'],
    description:
      'Links curtos com miniatura personalizada para compartilhar no WhatsApp. O endereço é jorgesolla1313.com.br/<slug>: no modo "Levar direto ao destino" o clique leva direto ao destino no ar; no modo "Página de anúncio" o visitante vê a página do evento até alguém marcar um destino no ar.',
  },
  access: {
    read: publishedOrPanelAccess,
    create: canManagePublishedContent,
    update: canManagePublishedContent,
    delete: canManagePublishedContent,
  },
  hooks: {
    beforeValidate: [validateShareLinkConfiguration],
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
          'Título do cartão no WhatsApp e da página de anúncio — o WhatsApp mostra no máximo 2 linhas (~60–90 caracteres).',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'slug',
          type: 'text',
          label: 'Slug',
          required: true,
          unique: true,
          index: true,
          admin: {
            width: '50%',
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
          name: 'mode',
          type: 'select',
          label: 'Modo do link',
          required: true,
          defaultValue: 'direct',
          options: SHARE_LINK_MODE_OPTIONS,
          admin: {
            width: '50%',
            description:
              '"Levar direto ao destino" exige um destino no ar. "Página de anúncio" mostra a página do evento enquanto nenhum destino estiver no ar.',
          },
        },
      ],
    },
    {
      name: 'destinations',
      type: 'array',
      label: 'Destinos',
      labels: { singular: 'Destino', plural: 'Destinos' },
      admin: {
        description:
          'Pré-cadastre os lugares para trocar sem digitar URL no dia. Marque "Destino no ar" em um único destino; nenhum marcado = pré-transmissão (só no modo "Página de anúncio").',
        components: {
          RowLabel: './components/admin/ShareLinkDestinationRowLabel#ShareLinkDestinationRowLabel',
        },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              type: 'text',
              label: 'Rótulo',
              required: true,
              admin: {
                width: '30%',
                description: 'Como o destino aparece para a equipe e na página (ex.: Google Meet).',
              },
            },
            {
              name: 'url',
              type: 'text',
              label: 'URL do destino',
              required: true,
              admin: {
                width: '45%',
                description:
                  'URL completa do destino (ex.: o link do Google Meet da plenária), começando com http:// ou https://.',
              },
              hooks: {
                beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
              },
              validate: validateDestination,
            },
            {
              name: 'live',
              type: 'checkbox',
              label: 'Destino no ar',
              defaultValue: false,
              admin: {
                width: '25%',
                description:
                  'Marque um único destino quando a transmissão começar. Desmarque para voltar à pré-transmissão.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      required: true,
      maxLength: SHARE_LINK_DESCRIPTION_MAX_LENGTH,
      admin: {
        description:
          'Texto do cartão no WhatsApp e da página de anúncio: ~80 caracteres já bastam; evitar passar de ~160.',
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
      type: 'collapsible',
      label: 'Dados do evento',
      admin: {
        initCollapsed: false,
        description: 'Usados na página de anúncio e nas opções de agenda.',
        condition: announcementOnly,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'startsAt',
              type: 'date',
              label: 'Início',
              admin: {
                width: '50%',
                description: 'Horário da Bahia.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'endsAt',
              type: 'date',
              label: 'Fim',
              admin: {
                width: '50%',
                description: 'Opcional. Sem fim, a agenda usa duração padrão de 2 horas.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },
        {
          name: 'location',
          type: 'text',
          label: 'Local',
          admin: {
            description:
              'Onde acontece (ex.: Online). Usado na página de anúncio e nas opções de agenda.',
          },
        },
      ],
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
