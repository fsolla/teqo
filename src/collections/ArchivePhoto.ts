import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Field,
} from 'payload'
import { ValidationError } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import {
  ARCHIVE_PHOTO_CAPTION_MAX_LENGTH,
  ARCHIVE_PHOTO_CATALOG_SOURCES,
  ARCHIVE_PHOTO_CURATED_FIELDS,
  ARCHIVE_PHOTO_DESCRIPTION_MAX_LENGTH,
  ARCHIVE_PHOTO_PUBLICATION_STATUSES,
  ARCHIVE_PHOTO_SCENES,
  ARCHIVE_PHOTO_VISIBLE_TEXT_MAX_LENGTH,
  archivePhotoCatalogSourceLabels,
  archivePhotoCuratedFieldLabels,
  archivePhotoPublicationStatusLabels,
  archivePhotoSearchText,
  archivePhotoTakenOn,
  changedArchivePhotoCuratedFields,
  isArchivePhotoRemovalChannelUrl,
} from '@/lib/archivePhotoCatalog'
import { SPEECH_TOPICS } from '@/lib/speechFacets'
import { canReadArchivePhoto, payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateArchivePhotosListing } from '@/utilities/documents'
import { purgeFaceDescriptorsForPhoto } from '@/utilities/faceIndex/faceDescriptorIndex'

/**
 * C231 — private upload collection of the Flickr photo archive: the ORIGINAL
 * file plus the metadata the Flickr listing brought (date, albums,
 * title/description/tags, geotag, EXIF). Like `internetSpeechMedia` and
 * `recordingMedia`, deliberately NOT `media`: that collection is anonymous-read
 * by contract (public pages), while the raw archive may only be read by the
 * communication roles. It is ingested by `pnpm flickr:import` and nothing here
 * publishes — C232 curates, C233/C234 publish.
 *
 * `alt` is required by the upload contract and derived by the ingestion
 * (`archivePhotoAlt`); the remaining Flickr fields document provenance and feed
 * the catalogue. The stored name is deterministic (`flickr-<id>.<ext>`), so a
 * re-run converges by overwriting the same object key.
 *
 * C232 adds the curated pre-cataloguing on these same rows: the `catalog` group
 * (proposal + honest `source`/`catalogedAt` state), `curatedFields` (what the
 * assessoria edited — the pipeline never overwrites it), `takenOn` (date facet
 * derived from the Flickr wall clock) and `searchText` (the normalized haystack
 * the admin list search matches).
 */

const catalogGroup: Field = {
  name: 'catalog',
  type: 'group',
  label: 'Pré-catalogação',
  admin: {
    description:
      'Proposta automática (IA + metadados). A assessoria revisa na ficha: o que ela editar entra em "Campos curados" e nunca é sobrescrito.',
  },
  fields: [
    {
      name: 'caption',
      type: 'text',
      label: 'Legenda',
      maxLength: ARCHIVE_PHOTO_CAPTION_MAX_LENGTH,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      maxLength: ARCHIVE_PHOTO_DESCRIPTION_MAX_LENGTH,
      admin: {
        description: 'Descrição semântica do que a foto mostra (não substitui a do Flickr).',
      },
    },
    {
      name: 'scene',
      type: 'select',
      label: 'Atividade/cena',
      index: true,
      options: ARCHIVE_PHOTO_SCENES.map((scene) => ({ value: scene.value, label: scene.label })),
    },
    {
      name: 'visibleText',
      type: 'textarea',
      label: 'Texto visível',
      maxLength: ARCHIVE_PHOTO_VISIBLE_TEXT_MAX_LENGTH,
      admin: {
        description: 'Texto legível na imagem (faixas, placas, banners).',
      },
    },
    {
      name: 'hasPeople',
      type: 'checkbox',
      label: 'Pessoas na cena',
      admin: {
        description: 'Presença de pessoas na foto — sem identificação de rosto (biometria é C234).',
      },
    },
    {
      name: 'themes',
      type: 'select',
      label: 'Temas',
      hasMany: true,
      index: true,
      options: SPEECH_TOPICS.map((topic) => ({ value: topic.value, label: topic.label })),
    },
    {
      name: 'people',
      type: 'text',
      hasMany: true,
      label: 'Pessoas públicas',
      admin: {
        description:
          'Somente nomes do catálogo curado, mencionados no texto da foto; nunca inferidos de rosto.',
      },
    },
    {
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Município',
      index: true,
      admin: {
        description: 'Quando o texto da foto aponta um município sem ambiguidade.',
      },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Origem',
      options: ARCHIVE_PHOTO_CATALOG_SOURCES.map((source) => ({
        value: source,
        label: archivePhotoCatalogSourceLabels[source],
      })),
      admin: {
        readOnly: true,
        description: 'IA = o modelo contribuiu; Metadados = só o texto derivou; Nada a propor.',
      },
    },
    {
      name: 'catalogedAt',
      type: 'date',
      label: 'Catalogada em',
      index: true,
      admin: {
        readOnly: true,
        description: 'Chave de idempotência: foto com data preenchida não é reprocessada.',
      },
    },
  ],
}

/**
 * C232 — the catalogue index the admin list uses: `takenOn` (date facet derived
 * from the Flickr wall clock) and `searchText` (normalized haystack). When a
 * request carries a user (an admin edit), the fields that actually changed are
 * added to `curatedFields` — the cataloguing/hook never marks on system writes
 * (`context.archivePhotoCatalog`, or no user at all).
 */
const deriveArchivePhotoCatalogIndex: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  // C234 — the face-index batch only ever writes the hidden `faces` group
  // (the marker), so it skips the search-text/município derivation entirely;
  // the curation marking below is already gated on `req.user` and never runs
  // for a session-less CLI.
  if (req.context?.faceIndex) return data

  if (req.user && !req.context?.archivePhotoCatalog) {
    const changed = changedArchivePhotoCuratedFields({ data, originalDoc })
    if (changed.length > 0) {
      const curated = new Set<string>(originalDoc?.curatedFields ?? [])
      for (const field of changed) curated.add(field)
      data.curatedFields = [...curated]
    }
  }

  const takenAt = data.takenAt ?? originalDoc?.takenAt ?? null
  data.takenOn = archivePhotoTakenOn(takenAt)

  const catalog = { ...(originalDoc?.catalog ?? {}), ...(data.catalog ?? {}) }
  const rawMunicipality = catalog.municipality
  const municipalityId =
    typeof rawMunicipality === 'number'
      ? rawMunicipality
      : rawMunicipality && typeof rawMunicipality === 'object'
        ? rawMunicipality.id
        : null
  const municipality =
    municipalityId != null
      ? await req.payload
          .findByID({
            collection: 'municipality',
            id: municipalityId,
            depth: 0,
            select: { name: true, slug: true },
            // Intentional admin bypass: the município catalog is read-only geography.
            overrideAccess: true,
            req,
          })
          .catch(() => null)
      : null

  // C233 — the public album reads `depth 0` on this row (the `municipality`
  // collection is campaign-only), so the label/slug the facet needs are
  // snapshotted here, where the geography read already happens.
  data.municipalityName = municipality?.name ?? null
  data.municipalitySlug = municipality?.slug ?? null

  data.searchText = archivePhotoSearchText({
    alt: data.alt ?? originalDoc?.alt,
    title: data.title ?? originalDoc?.title,
    description: data.description ?? originalDoc?.description,
    catalogDescription: catalog.description,
    caption: catalog.caption,
    scene: catalog.scene,
    visibleText: catalog.visibleText,
    themes: catalog.themes,
    people: catalog.people,
    municipalityName: municipality?.name ?? null,
    albumTitles: (data.albums ?? originalDoc?.albums ?? []).map(
      (album: { title?: string | null }) => album?.title,
    ),
    tagNames: (data.tags ?? originalDoc?.tags ?? []).map(
      (tag: { name?: string | null }) => tag?.name,
    ),
  })
  return data
}

/**
 * C233 — fail-closed: a photo only becomes public with a visible removal
 * channel ("é você nesta foto? peça a remoção"). The channel is product data
 * configured in the album global; this guard never invents one — it refuses
 * the approval until a valid channel exists.
 */
const requireRemovalChannelForApproval: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data) return data
  // Only the transition INTO approval is guarded: a later edit of an already
  // approved photo (the cataloguing pipeline included) never re-checks the
  // channel, and the album global keeps the open album from losing it.
  if (data.publicationStatus !== 'approved') return data

  // Intentional admin bypass: the channel is public read-only product data and
  // the guard must not depend on the role of whoever is approving.
  const album = await req.payload
    .findGlobal({ slug: 'photoAlbum', depth: 0, overrideAccess: true, req })
    .catch(() => null)
  if (!isArchivePhotoRemovalChannelUrl(album?.removalChannelUrl)) {
    throw new ValidationError({
      errors: [
        {
          path: 'publicationStatus',
          message:
            'Configure o canal de remoção (Configurações → Álbum de fotos) antes de aprovar uma foto.',
        },
      ],
    })
  }
  return data
}

/**
 * C233 — the seam with the public album: every write of a photo (the ficha,
 * the cataloguing pipeline, the takedown) busts the listing tag `/fotos`
 * caches under. A collection hook and not a per-caller line, so a new write
 * path cannot forget it — an `approved→removed` edit pulls the photo AND its
 * media (the cached by-id read) down without a deploy.
 */
const revalidateArchivePhotosListingAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateArchivePhotosListing()
  return doc
}

const revalidateArchivePhotosListingAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateArchivePhotosListing()
  return doc
}

/**
 * C242 — a photo that stops being `approved` cannot keep answering the selfie
 * search: the anonymous descriptor rows die with the public status (and on
 * deletion), the same fail-closed spirit of the C233 read. The FK cascade
 * covers direct SQL deletes; this covers the Local API lifecycle.
 */
const purgeFaceDescriptorsAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (doc.publicationStatus !== 'approved') {
    await purgeFaceDescriptorsForPhoto({ payload: req.payload, photoId: doc.id, req })
  }
  return doc
}

const purgeFaceDescriptorsAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await purgeFaceDescriptorsForPhoto({ payload: req.payload, photoId: doc.id, req })
  return doc
}

/**
 * C234 — the batch state of the selfie-search index (`pnpm faces:index`). The
 * `checkedKey` is what lets the batch skip a photo honestly: it summarizes the
 * model plus every eligible subject, so a new enrollment (or a model change)
 * changes the key and the photo is reprocessed. Written only by the CLI; no
 * admin surface (hidden) and never edited by hand.
 */
const facesGroup: Field = {
  name: 'faces',
  type: 'group',
  label: 'Índice facial',
  admin: {
    hidden: true,
    description: 'Estado do lote da busca por selfie (C234). Nunca editado à mão.',
  },
  fields: [
    {
      name: 'checkedAt',
      type: 'date',
      label: 'Verificada em',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'checkedKey',
      type: 'text',
      label: 'Chave do índice',
      admin: {
        readOnly: true,
      },
    },
  ],
}

export const ArchivePhoto: CollectionConfig = {
  slug: ARCHIVE_PHOTO_SLUG,
  labels: {
    singular: 'Foto do acervo',
    plural: 'Fotos do acervo',
  },
  admin: {
    group: 'Comunicação',
    description:
      'Originais e metadados do acervo de fotos do Flickr (conta depjorgesolla). Só abrem com login da campanha.',
    useAsTitle: 'alt',
    defaultColumns: [
      'alt',
      'publicationStatus',
      'takenOn',
      'catalog.scene',
      'catalog.municipality',
      'catalog.source',
    ],
    listSearchableFields: ['searchText'],
  },
  access: {
    create: payloadAdminOnly,
    read: canReadArchivePhoto,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeValidate: [deriveArchivePhotoCatalogIndex, requireRemovalChannelForApproval],
    afterChange: [revalidateArchivePhotosListingAfterChange, purgeFaceDescriptorsAfterChange],
    afterDelete: [revalidateArchivePhotosListingAfterDelete, purgeFaceDescriptorsAfterDelete],
  },
  fields: [
    {
      name: 'flickrId',
      type: 'text',
      label: 'ID no Flickr',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Identidade da foto no Flickr — a chave que torna a ingestão idempotente.',
      },
    },
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      required: true,
      admin: {
        description: 'Descrição do arquivo para acessibilidade.',
      },
    },
    catalogGroup,
    {
      name: 'publicationStatus',
      type: 'select',
      label: 'Publicação',
      required: true,
      index: true,
      defaultValue: 'draft',
      options: ARCHIVE_PHOTO_PUBLICATION_STATUSES.map((status) => ({
        value: status,
        label: archivePhotoPublicationStatusLabels[status],
      })),
      admin: {
        description:
          'Só "Aprovada" aparece no álbum público (/fotos). "Removida" é o estado de remoção a pedido — a catalogação automática nunca o altera e a foto não volta ao público sem uma nova edição humana.',
      },
    },
    {
      name: 'curatedFields',
      type: 'select',
      label: 'Campos curados pela assessoria',
      hasMany: true,
      options: ARCHIVE_PHOTO_CURATED_FIELDS.map((value) => ({
        value,
        label: archivePhotoCuratedFieldLabels[value],
      })),
      admin: {
        readOnly: true,
        description:
          'O que a assessoria já editou; a catalogação automática nunca sobrescreve estes campos.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Título no Flickr',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição no Flickr',
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags do Flickr',
      labels: { singular: 'Tag', plural: 'Tags' },
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Tag',
          required: true,
        },
      ],
    },
    {
      name: 'takenAt',
      type: 'text',
      label: 'Data da foto',
      admin: {
        description: 'Data informada pelo Flickr, sem fuso (YYYY-MM-DD HH:MM:SS).',
      },
    },
    {
      name: 'takenOn',
      type: 'date',
      label: 'Dia da foto',
      index: true,
      admin: {
        readOnly: true,
        description: 'Derivado da data da foto (meio-dia UTC, sem fuso).',
      },
    },
    {
      name: 'postedAt',
      type: 'text',
      label: 'Publicada em',
      admin: {
        description: 'Data de publicação no Flickr (ISO 8601, UTC).',
      },
    },
    {
      name: 'albums',
      type: 'array',
      label: 'Álbuns',
      labels: { singular: 'Álbum', plural: 'Álbuns' },
      fields: [
        {
          name: 'albumId',
          type: 'text',
          label: 'ID do álbum',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
          label: 'Título do álbum',
          required: true,
        },
      ],
    },
    {
      name: 'geo',
      type: 'group',
      label: 'Geotag',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          label: 'Latitude',
        },
        {
          name: 'longitude',
          type: 'number',
          label: 'Longitude',
        },
      ],
    },
    {
      name: 'exif',
      type: 'json',
      label: 'EXIF',
      admin: {
        description: 'Metadados EXIF da foto, como o Flickr respondeu ({ tag, label, value }).',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Página no Flickr',
    },
    {
      name: 'owner',
      type: 'text',
      label: 'Conta (NSID)',
    },
    {
      name: 'license',
      type: 'text',
      label: 'Licença (Flickr)',
    },
    {
      name: 'municipalityName',
      type: 'text',
      label: 'Município (nome)',
      admin: {
        readOnly: true,
        description:
          'Derivado do município da ficha, para o álbum público ler sem tocar a collection campaign-only.',
      },
    },
    {
      name: 'municipalitySlug',
      type: 'text',
      label: 'Município (slug público)',
      index: true,
      admin: {
        readOnly: true,
        description: 'Faceta de município da URL pública (`/fotos?municipio=<slug>`).',
      },
    },
    {
      name: 'searchText',
      type: 'textarea',
      label: 'Texto normalizado (busca)',
      admin: {
        readOnly: true,
        description:
          'Tudo o que a busca da lista encontra, normalizado (sem acentos, minúsculas): legenda, texto visível, temas, pessoas, município, álbuns e tags.',
      },
    },
    facesGroup,
  ],
  upload: true,
}
