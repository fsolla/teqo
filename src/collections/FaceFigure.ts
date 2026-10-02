import { FACE_SEARCH_MODEL } from '@/lib/faceSearch'
import { slugify } from '@/lib/slug'
import { payloadAdminOnly } from '@/utilities/campaignAccess'
import { revalidateArchivePhotosListing } from '@/utilities/documents'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

/**
 * C244 — the curated catalog of public figures the album's `pessoa` facet may
 * name. Each row is a person of the mandate's curated catalog (the figure) and
 * its reference descriptors (1–8 official/archive portraits, enrolled by
 * `pnpm faces:enroll-figure`), compared against the anonymous index of C242 at
 * read time. This is biometric identification of NAMED public figures only,
 * under the legal sign-off registered in the runbook; a face outside this
 * catalog stays anonymous in the index and is never named.
 *
 * The collection is admin-only and auditable: curation can deactivate a figure
 * (it leaves the facet) or remove a reference, and both revalidate the public
 * album. The descriptors never leave the server (`admin.hidden` on the vector).
 */
const revalidateAlbum: CollectionAfterChangeHook = ({ doc }) => {
  revalidateArchivePhotosListing()
  return doc
}

const revalidateAlbumAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateArchivePhotosListing()
  return doc
}

export const FaceFigure: CollectionConfig = {
  slug: 'faceFigure',
  labels: {
    singular: 'Figura pública',
    plural: 'Figuras públicas',
  },
  admin: {
    group: 'Comunicação',
    useAsTitle: 'name',
    description:
      'Catálogo curado de figuras públicas do filtro "Pessoa pública" do álbum (C244). Só entram nomes com aval jurídico registrado; a referência biométrica é curada e auditável, e nunca inclui terceiros. Descritores são gravados pela CLI faces:enroll-figure.',
  },
  access: {
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    afterChange: [revalidateAlbum],
    afterDelete: [revalidateAlbumAfterDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome público',
      required: true,
      unique: true,
      admin: {
        description: 'Nome exibido na faceta (ex.: "Lula", "Jerônimo").',
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
          'Valor de ?pessoa=<slug> no álbum; gerado do nome quando vazio. Mudar o slug quebra a URL pública do filtro.',
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
      name: 'fullName',
      type: 'text',
      label: 'Nome completo',
      admin: {
        description: 'Proveniência da curadoria; não aparece no site.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'Ativa',
      defaultValue: true,
      index: true,
      admin: {
        description: 'Desmarcar tira a figura do filtro imediatamente.',
      },
    },
    {
      name: 'references',
      type: 'array',
      label: 'Descritores de referência',
      labels: {
        singular: 'Descritor de referência',
        plural: 'Descritores de referência',
      },
      maxRows: 3,
      admin: {
        description:
          'Retratos oficiais/arquivo, 1–3 por figura, gravados pela CLI faces:enroll-figure. Remover uma linha corrige a curadoria; adicionar só pela CLI (o vetor não é editável à mão).',
      },
      fields: [
        {
          name: 'vector',
          type: 'json',
          label: 'Descriptor',
          admin: {
            hidden: true,
          },
        },
        {
          name: 'model',
          type: 'text',
          label: 'Modelo',
          admin: {
            readOnly: true,
            description: `Modelo do descriptor (atual: ${FACE_SEARCH_MODEL}).`,
          },
        },
        {
          name: 'source',
          type: 'text',
          label: 'Origem',
          required: true,
          admin: {
            description: 'Retrato/arquivo de origem da referência (proveniência da curadoria).',
          },
        },
        {
          name: 'addedAt',
          type: 'date',
          label: 'Adicionado em',
          admin: {
            readOnly: true,
          },
        },
      ],
    },
  ],
}
