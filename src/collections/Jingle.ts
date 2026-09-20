import { slugify } from '@/lib/slug'
import { canManagePublishedContent, publishedOrPanelAccess } from '@/utilities/campaignAccess'
import { revalidateJinglesListing } from '@/utilities/documents'
import type { CollectionConfig, TextFieldSingleValidation } from 'payload'

/**
 * S21 — the public jingles page. A flat, ordered list of pieces (cover + MP3)
 * served at `/jingles`. `published` is the kill switch (unchecked → invisible
 * everywhere, file kept); anonymous reads fail closed through the shared
 * `publishedOrPanelAccess` `where`, the same contract as `ShareLink`.
 */
const validateSlug: TextFieldSingleValidation = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return 'Use um título com letras ou números — o slug vira o nome do arquivo no download.'
  }
  return true
}

export const Jingle: CollectionConfig = {
  slug: 'jingle',
  labels: {
    singular: 'Jingle',
    plural: 'Jingles',
  },
  admin: {
    group: 'Publicações',
    useAsTitle: 'title',
    defaultColumns: ['title', 'order', 'published'],
    description:
      'Peças de áudio do site público (/jingles). Suba o MP3 e a capa pela Mídia; desmarcar "Publicado" tira o jingle do ar na hora, sem apagar arquivo.',
  },
  access: {
    read: publishedOrPanelAccess,
    create: canManagePublishedContent,
    update: canManagePublishedContent,
    delete: canManagePublishedContent,
  },
  hooks: {
    afterChange: [revalidateJinglesListing],
    afterDelete: [revalidateJinglesListing],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      admin: {
        description: 'Nome curto exibido no card (ex.: Axé).',
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      unique: true,
      index: true,
      admin: {
        description:
          'Gerado automaticamente a partir do título quando vazio. Vira o nome do arquivo no download (jorge-solla-1313-<slug>.mp3).',
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
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Capa',
      required: true,
      admin: {
        description: 'Imagem quadrada exibida acima do player (JPG/PNG otimizados).',
      },
    },
    {
      name: 'audio',
      type: 'upload',
      relationTo: 'media',
      label: 'Áudio (MP3)',
      required: true,
      admin: {
        description:
          'O MP3 que toca e baixa. O mesmo arquivo serve para ouvir e baixar; não suba WAV. A Mídia pede um texto alternativo — use algo como "Jingle Axé — áudio".',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Ordem',
      admin: {
        description: 'Menor vem primeiro; vazio vai ao fim. Empate desempata pelo título.',
      },
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Publicado',
      defaultValue: false,
      admin: {
        description: 'Desmarcado, o jingle some do site e do rodapé na hora (kill switch).',
      },
    },
  ],
}
