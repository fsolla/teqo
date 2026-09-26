import type { CollectionBeforeValidateHook, CollectionConfig, Field } from 'payload'

import { ARCHIVE_PHOTO_SLUG } from '@/lib/archivePhoto'
import {
  ARCHIVE_PHOTO_CAPTION_MAX_LENGTH,
  ARCHIVE_PHOTO_CATALOG_SOURCES,
  ARCHIVE_PHOTO_CURATED_FIELDS,
  ARCHIVE_PHOTO_DESCRIPTION_MAX_LENGTH,
  ARCHIVE_PHOTO_SCENES,
  ARCHIVE_PHOTO_VISIBLE_TEXT_MAX_LENGTH,
  archivePhotoCatalogSourceLabels,
  archivePhotoCuratedFieldLabels,
  archivePhotoSearchText,
  archivePhotoTakenOn,
  changedArchivePhotoCuratedFields,
} from '@/lib/archivePhotoCatalog'
import { SPEECH_TOPICS } from '@/lib/speechFacets'
import { canReadArchivePhoto, payloadAdminOnly } from '@/utilities/campaignAccess'

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
            select: { name: true },
            // Intentional admin bypass: the município catalog is read-only geography.
            overrideAccess: true,
            req,
          })
          .catch(() => null)
      : null

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
    defaultColumns: ['alt', 'takenOn', 'catalog.scene', 'catalog.municipality', 'catalog.source'],
    listSearchableFields: ['searchText'],
  },
  access: {
    create: payloadAdminOnly,
    read: canReadArchivePhoto,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeValidate: [deriveArchivePhotoCatalogIndex],
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
      name: 'searchText',
      type: 'textarea',
      label: 'Texto normalizado (busca)',
      admin: {
        readOnly: true,
        description:
          'Tudo o que a busca da lista encontra, normalizado (sem acentos, minúsculas): legenda, texto visível, temas, pessoas, município, álbuns e tags.',
      },
    },
  ],
  upload: true,
}
